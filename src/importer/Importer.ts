import {Neo4JDriver} from './Neo4JDriver';
import {ClassifiedTimeLine} from '../analyzer/ClassifiedTimeLine';
import {User} from '../crawler/User';
import {google} from '@google-cloud/language/build/protos/protos';
import {Tweet} from '../crawler/Tweet';
import {ClassifiedTweet} from '../analyzer/ClassifiedTweet';
import IEntity = google.cloud.language.v1beta2.IEntity;
import IClassificationCategory = google.cloud.language.v1beta2.IClassificationCategory;

export class Importer
{
    private session;

    constructor()
    {
        this.session = Neo4JDriver.instance.session();
        console.log(`[IMPORTER] Importer has been initialized and session has been opened.`);
    }

    /**
     * Creates nodes and relationships accordingly to provided timeLine
     * @param {ClassifiedTimeLine} timeLine
     * @returns {Promise<void>}
     */
    public async importTimeLine(timeLine: ClassifiedTimeLine): Promise<void>
    {
        const user: User = timeLine.user;
        await this.createUser(user);

        for (const tweet of timeLine.tweets)
        {
            const entities: IEntity[] = tweet.entities;
            const categories: IClassificationCategory[] = tweet.categories;

            await this.createTweet(user, tweet);
            await this.createCategories(categories, tweet);
            await this.createEntities(entities, tweet);
        }
    }

    /**
     * Deletes all nodes with and without relationships
     * @returns {Promise<void>}
     */
    public async cleanDB(): Promise<void>
    {
        try
        {
            await this.session.run(`MATCH (a)-[r] -> () DELETE a,r`);
            await this.session.run(`MATCH (a) DELETE a`);
        }
        catch (e)
        {
            console.error(`[ERR] Could not clean database, because: ${e.message}`);
            await this.session.close();
            return;
        }

        console.log(`[IMPORTER] All nodes and relationships have been deleted.`);
    }

    /**
     * Closes current session
     * @returns {Promise<void>}
     */
    public async close(): Promise<void>
    {
        await this.session.close();
    }

    /**
     * Creates the user root node, containing no relationships at all.
     * @param {User} user User to create node of
     * @returns {Promise<void>}
     */
    private async createUser(user: User): Promise<void>
    {
        try
        {
            await this.session.run(
                `CREATE (u: User
                {
                    id: $id,
                    name: $account
                })`,
                {id: user.id, account: user.account}
            );
        }
        catch (e)
        {
            console.error(`[ERR] Could not create user node, because ${e.message}`);
            return;
        }

        console.log(`[(U)] User node ${user.account} has been created.`);
    }

    /**
     * Creates a twitter node and adds a relationship to the provided user
     * @param {User} user User who has tweeted the tweet
     * @param {Tweet} tweet Tweet which has been written
     * @returns {Promise<void>}
     */
    private async createTweet(user: User, tweet: ClassifiedTweet): Promise<void>
    {
        try
        {
            await this.session.run(
                `MATCH (u: User) WHERE u.id = $userId
                CREATE (t: Tweet
                {
                    id: $id,
                    text: $text,
                    date: $created,
                    likes: $likes,
                    retweets: $retweets,
                    replies: $replies,
                    quotes: $quotes,
                    sentiment: $sentiment,
                    magnitude: $magnitude
                })<-[:TWEETED {sentiment: $sentiment, magnitude: $magnitude}]-(u)`,
                {
                    userId   : user.id,
                    id       : tweet.id,
                    text     : tweet.text,
                    created  : tweet.created,
                    likes    : tweet.likes,
                    retweets : tweet.retweets,
                    replies  : tweet.replies,
                    quotes   : tweet.quotes,
                    sentiment: Number(tweet.sentiment.score.toFixed(3)),
                    magnitude: Number(tweet.sentiment.magnitude.toFixed(3))
                }
            );
        }
        catch (e)
        {
            console.error(`[ERR] Could not create tweet node, because ${e.message}`);
            return;
        }

        console.log(`[(T)<-(U)] Tweet node ${tweet.id} has been created and added to ${user.account}.`);
    }

    /**
     * Creates category nodes and adds relationship to the provided tweet
     * @param {google.cloud.language.v1beta2.IClassificationCategory[]} categories Categories found in tweet
     * @param {Tweet} tweet Tweet containing the categories
     * @returns {Promise<void>}
     */
    private async createCategories(categories: IClassificationCategory[], tweet: Tweet): Promise<void>
    {
        for (const category of categories)
        {
            try
            {
                await this.session.run(
                    `MATCH (t: Tweet) WHERE t.id = $tweetId
                    CREATE (c: Topic
                    {
                        name: $name,
                        accuracy: $accuracy
                    })<-[:HAS]-(t)`,
                    {
                        tweetId : tweet.id,
                        name    : category.name,
                        accuracy: category.confidence
                    }
                );
            }
            catch (e)
            {
                console.error(`[ERR] Could not create category node, because ${e.message}`);
                return;
            }

            console.log(`[(T)<-(C)] Category node ${category.name} has been created and added to ${tweet.id}.`);
        }
    }

    /**
     * Creates entity nodes and adds relationship to the provided tweet
     * @param {google.cloud.language.v1beta2.IEntity[]} entities Entities found in tweet
     * @param {Tweet} tweet Tweet containing the categories
     * @returns {Promise<void>}
     */
    private async createEntities(entities: IEntity[], tweet: Tweet): Promise<void>
    {
        for (const entity of entities)
        {
            try
            {
                await this.session.run(
                    `MATCH (t: Tweet) WHERE t.id = $tweetId
                    CREATE (e: Entity
                    {
                        name: $name,
                        type: $type
                    })<-[:CONTAINS]-(t)`,
                    {
                        tweetId  : tweet.id,
                        name     : entity.name,
                        type     : entity.type
                    }
                );
            }
            catch (e)
            {
                console.error(`[ERR] Could not create entity node, because ${e.message}`);
                return;
            }

            console.log(`[(T)<-(E)] Entity node ${entity.name} has been created and added to ${tweet.id}.`);
        }
    }
}
