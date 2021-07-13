import {User} from './User';
import fetch, {RequestInit} from 'node-fetch';
import {TimeLine} from './TimeLine';
import {Tweet} from './Tweet';
import * as fs from 'fs';
import * as path from 'path';

export interface TweetConfig
{
    apiKey: string;
    apiSecretKey: string;
    bearerToken: string;
    maxAmount: number;
}

export interface RawUserData
{
    id: string;
    name: string;
    username: string;
}

export interface RawTweetData
{
    created_at: string;
    id: string;
    text: string;
    public_metrics: {
        like_count: number;
        reply_count: number;
        retweet_count: number;
        quote_count: number;
    }
}

interface RawMetaData
{
    newest_id: string;
    next_token: string;
    oldest_id: string;
    previous_token: string;
    result_count: number;
}

interface RawResponse
{
    data: [RawTweetData];
    meta: RawMetaData;
}

export class TweetCrawler
{
    public readonly userList: User[] = [];
    private timeLines: TimeLine[] = [];
    private config: TweetConfig;

    constructor(config: TweetConfig)
    {
        if (!config.apiKey || !config.apiSecretKey || !config.bearerToken)
            throw Error('API Settings haven\'t been set properly.');

        this.config = config;
    }

    /**
     * Retrieves a users account information from Twitter by provided account name.
     * User will be pushed into instance userList.
     * @param {string} username Account name to look up
     * @returns {Promise<void>}
     */
    async createTwitterUserBy(username: string): Promise<void>
    {
        try
        {
            const options: RequestInit = {headers: {'Authorization': `Bearer ${this.config.bearerToken}`}};
            const res = await fetch(`https://api.twitter.com/2/users/by/username/${username}`, options);

            if (res.status >= 300)
                throw Error(`Response status not expected: ${res.status}`);

            const {data}: { data: RawUserData } = await res.json();
            const user = new User(data.id, username);
            this.userList.push(user);

            console.log(`[+] User ${username} has been found and added to crawling list.`);
        }
        catch (e)
        {
            console.error(`[ERR] Cannot create TwitterUser for ${username}, because: ${e.message}`);
            return;
        }
    }

    /**
     * Crawls Tweets from a provided Twitter Account by using its Twitter Account Id
     * @param {User} user User to crawl tweets from
     * @returns {Promise<void>}
     */
    async crawlTimeLineFor(user: User): Promise<void>
    {
        try
        {
            if (!user.id)
                throw Error(`Missing id for user ${user.account}`);

            const rawTweetData: RawTweetData[] = await this.fetchTimeLineFor(user);
            const tweets: Tweet[] = [];

            rawTweetData.forEach(tweetData =>
            {
                const tweet = new Tweet(tweetData.id);
                tweet.setRawTweetData(tweetData);
                if (tweet.isTextValid()) tweets.push(tweet);
            });
            this.timeLines.push(new TimeLine(user, tweets));

            console.log(`[CRAWLED] TimeLine for User ${user.account} has been crawled.`);
        }
        catch (e)
        {
            console.error(`[ERR] Cannot create TimeLine for ${user.account}, because: ${e.message}`);
            return;
        }
    }

    /**
     * Fetches the Twitter TimeLine for a specific and provided user, returns the RawTweetData
     * @param {User} user User whose Timeline will be fetched
     * @returns {Promise<void>}
     */
    private async fetchTimeLineFor(user: User): Promise<RawTweetData[]>
    {
        let rawTweetData: RawTweetData[] = [];
        const maxLoops: number = Math.ceil(this.config.maxAmount / 100);
        const maxResults: number = this.config.maxAmount > 100 ? 100 : this.config.maxAmount;
        const endpointURL: string = `https://api.twitter.com/2/users/${user.id}/tweets`;

        const options: RequestInit = {headers: {'Authorization': `Bearer ${this.config.bearerToken}`}};
        const params: URLSearchParams = new URLSearchParams({
            'tweet.fields': 'created_at,public_metrics',
            'max_results' : maxResults.toString()
        });

        try
        {
            for (let i = 0; i < maxLoops; i++)
            {
                const res = await fetch(`${endpointURL}?${params.toString()}`, options);

                if (res.status >= 300)
                    throw Error(`Response status not expected: ${res.status}`);

                const {data, meta}: RawResponse = await res.json();
                rawTweetData = [...rawTweetData, ...data];

                console.log(`[CRAWLER] Fetched ${rawTweetData.length} Tweets of ${this.config.maxAmount}`);

                if (!meta.next_token) break;
                params.set('pagination_token', meta.next_token);
            }
        }
        catch (e)
        {
            console.error(`[ERR] Cannot continue to fetch tweets, because: ${e}`);
            return rawTweetData;
        }

        return rawTweetData;
    }

    /**
     * Stores TimeLines in provided rawTweetsPath
     * @param {string} rawTweetsPath rawTweetsPath where to store TimeLines
     */
    public storeTwitterData(rawTweetsPath: string): void
    {
        for (const timeLine of this.timeLines)
        {
            const userFile = path.resolve(rawTweetsPath, `${timeLine.user.account}.json`);
            fs.writeFileSync(userFile, JSON.stringify(timeLine, null, 4));
        }
    }
}
