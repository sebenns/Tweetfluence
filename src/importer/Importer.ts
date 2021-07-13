import {Neo4JDriver} from './Neo4JDriver';
import {ClassifiedTimeLine} from '../analyzer/ClassifiedTimeLine';
import {User} from '../crawler/User';
import {google} from '@google-cloud/language/build/protos/protos';
import {Tweet} from '../crawler/Tweet';
import {ClassifiedTweet} from '../analyzer/ClassifiedTweet';
import {QueryResult} from 'neo4j-driver';
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
     * Additional functions for cleanup and algorithms after importing data
     * @returns {Promise<void>}
     */
    public async afterImport(): Promise<void>
    {
        await this.mergeCategories();
        await this.createSentimentEdge();
        await this.close();
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
            const topics: string[] = category.name.split('/').filter(t => t !== '');

            try
            {
                for (const topic of topics)
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
                            name    : topic,
                            accuracy: category.confidence
                        }
                    );
                }
            }
            catch (e)
            {
                console.error(`[ERR] Could not create category node, because ${e.message}`);
                continue;
            }

            console.log(`[(T)<-(C)] Category node ${category.name} has been created and added to ${tweet.id}.`);
        }
    }

    /**
     * Merges duplicate categories in one, transfers edges to merged one
     * @returns {Promise<void>}
     */
    private async mergeCategories(): Promise<void>
    {
        try
        {
            await this.session.run(
                `MATCH (t: Topic)
                WITH t.name AS name, COLLECT (t) AS list, COUNT(*) AS count
                WHERE count > 1
                CALL apoc.refactor.mergeNodes(list) YIELD node
                RETURN node`
            );
        }
        catch (e)
        {
            console.error(`[ERR] Could not merge categories, because ${e.message}`);
            return;
        }

        console.log(`[IMPORTER] Categories have been successfully merged and edges moved.`);
    }

    /**
     * Creates an additional sentiment edge connecting the user node to the topic and adding
     * the amount of tweets which have included this topic and the average sentiment.
     * @returns {Promise<void>}
     */
    private async createSentimentEdge(): Promise<void>
    {
        try
        {
            const result: QueryResult = await this.session.run(
                `MATCH (c:Topic)-[r:HAS]-(tw:Tweet)-[t:TWEETED]-(u:User)
               WITH c,u, AVG(t.sentiment) AS avgS, count(tw) AS tweets, 
                  SUM(tw.likes) AS likes, SUM(tw.retweets) AS retweets, 
                  SUM(tw.replies) AS replies, SUM(tw.quotes) AS quotes
               RETURN u.id as userId, tweets, c.name as topic, avgS as sentiment, likes, retweets, replies, quotes`
            );

            for (const record of result.records)
            {
                const likes: number = Number(record.get('likes'));
                const retweets: number = Number(record.get('retweets'));
                const replies: number = Number(record.get('replies'));
                const quotes: number = Number(record.get('quotes'));
                const tweets: number = Number(record.get('tweets'));
                const reactionScore: number = Math.ceil((likes + replies) / tweets);
                const viralScore: number = Math.ceil((retweets + quotes) / tweets);

                await this.session.run(
                    `MATCH (u: User), (c: Topic) WHERE u.id = $userId AND c.name = $topic
                    CREATE (u)-[:TWEETS_ABOUT {
                        tweets: $tweets, 
                        sentiment: $sentiment,
                        likes: $likes,
                        retweets: $retweets,
                        quotes: $quotes,
                        replies: $replies,
                        viralScore: $viralScore,
                        reactionScore: $reactionScore
                    }]->(c)`,
                    {
                        userId   : record.get('userId'),
                        topic    : record.get('topic'),
                        tweets   : record.get('tweets'),
                        sentiment: Number(record.get('sentiment').toFixed(3)),
                        likes, retweets, replies, quotes, reactionScore, viralScore
                    }
                )
            }
        }
        catch (e)
        {
            console.error(`[ERR] Could not create an additional sentiment edge, because ${e.message}`);
            return;
        }

        console.log(`[IMPORTER] Edges connecting User and Topics have been created.`);
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
                        tweetId: tweet.id,
                        name   : entity.name,
                        type   : entity.type
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
