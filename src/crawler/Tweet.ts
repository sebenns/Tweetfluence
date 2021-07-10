import {RawTweetData} from './TweetCrawler';

export class Tweet
{
    public readonly id: string;
    public text: string;
    public created: string;

    public likes: number;
    public replies: number;
    public retweets: number;
    public quotes: number;

    constructor(id: string)
    {
        this.id = id;
    }

    public setRawTweetData(tweetData: RawTweetData): void
    {
        this.text = tweetData.text;
        this.created = tweetData.created_at;

        this.likes = tweetData.public_metrics.like_count;
        this.replies = tweetData.public_metrics.reply_count;
        this.retweets = tweetData.public_metrics.retweet_count;
        this.quotes = tweetData.public_metrics.quote_count;
    }

    public isTextValid(): boolean
    {
        return this.text.split(' ').length >= 20
    }

    public equals(t: Tweet): boolean
    {
        return t.id === t.id;
    }
}
