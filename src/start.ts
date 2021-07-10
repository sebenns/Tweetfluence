import * as path from 'path';
import {TweetConfig, TweetCrawler} from './crawler/TweetCrawler';
import * as fs from 'fs';
import {TimeLine} from './crawler/TimeLine';
import {TweetAnalyzer} from './analyzer/TweetAnalyzer';
import {ClassifiedTimeLine} from './analyzer/ClassifiedTimeLine';
import {AccountMap, Loader} from './utils/Loader';
import {Neo4JConfig, Neo4JDriver} from './utils/Neo4JDriver';

console.log("[RUN] Starting Twittfluence Application. Locating necessary input artefacts and folder...");

// root path, containing src, data & config
const root = path.resolve(__dirname, '..');

// data & config paths
const dataPath = path.resolve(root, 'data');
const configPath = path.resolve(root, 'config');
const accountsPath = path.resolve(configPath, 'accounts');

// raw-tweets & tweets paths
const rawTweetsPath = path.resolve(dataPath, 'raw-tweets');
const tweetsPath = path.resolve(dataPath, 'tweets');

// additional constants for fileNames
const twitterCfgFileName = 'twitter.cfg.json';
const googleCfgFileName = 'twittfluence.cfg.json';
const neo4jCfgFileName = 'neo4j.cfg.json';

const nodeArgs = {
    crawl    : '--crawl',
    sentiment: '--analyze',
    neo4j    : '--neo4j',
};

(async () =>
{
    if (process.argv.includes(nodeArgs.crawl) || process.argv.length === 2)
    {
        console.log(`[CRAWLER] Loading Twitter configuration file, containing API information.`);
        let twitterCfg: TweetConfig = {apiKey: '', apiSecretKey: '', bearerToken: '', maxAmount: 0};
        twitterCfg = {...Loader.loadJSON(configPath, twitterCfgFileName, twitterCfg)};

        console.log(`[CRAWLER] Loading AccountLists...`);
        const accountMap: AccountMap = Loader.loadAccountLists(path.resolve(accountsPath));

        for (const accountList of Object.keys(accountMap))
        {
            console.log(`[CRAWLER] Crawling TimeLines for ${accountList} AccountList.`);
            const tweetCrawler: TweetCrawler = new TweetCrawler(twitterCfg);

            for (const name of accountMap[accountList]) await tweetCrawler.createTwitterUserBy(name);
            for (const user of tweetCrawler.userList) await tweetCrawler.crawlTimeLineFor(user);

            try
            {
                const accountListPath = path.resolve(rawTweetsPath, accountList);
                if (!fs.existsSync(accountListPath)) fs.mkdirSync(accountListPath);
                tweetCrawler.storeTwitterData(accountListPath);

                console.log(`[FINISHED] Crawler has finished crawling & storing twitter data.`);
            }
            catch (e)
            {
                console.error(`[ERR] Could not store twitter data, because: ${e}`);
                process.exit(1);
            }
        }
    }

    if (process.argv.includes(nodeArgs.sentiment) || process.argv.length === 2)
    {
        try
        {
            console.log(`[ANALYZER] Setting up configuration file  ${googleCfgFileName} as env variable.`);
            const googleCfgPath = path.resolve(configPath, googleCfgFileName);

            if (!fs.existsSync(googleCfgPath)) throw Error(`File not found: ${googleCfgPath}`);
            process.env['GOOGLE_APPLICATION_CREDENTIALS'] = googleCfgPath;
        }
        catch (e)
        {
            console.error(`[ERR] Could not start Tweet Analyzer, because: ${e}`);
            process.exit(1);
        }

        console.log(`[ANALYZER] Loading AccountLists...`);
        const accountMap: AccountMap = Loader.loadAccountLists(accountsPath);
        const timeLines: TimeLine[] = [];

        console.log(`[ANALYZER] Retrieving crawled TimeLines by account list.`);

        for (const accountList of Object.keys(accountMap))
        {
            for (const account of accountMap[accountList])
            {
                const accountListPath = path.resolve(rawTweetsPath, accountList);
                const content: TimeLine = Loader.loadJSON(accountListPath, `${account}.json`);
                timeLines.push(content as TimeLine);

                console.log(`[+] Added timeLine for ${account}.`);
            }

            try
            {
                const tweetAnalyzer: TweetAnalyzer = new TweetAnalyzer();
                const classifiedTimeLines: ClassifiedTimeLine[] = [];
                const accountListPath = path.resolve(tweetsPath, accountList);

                for (const timeLine of timeLines) classifiedTimeLines.push(await tweetAnalyzer.analyzeTimeLine(timeLine));
                if (!fs.existsSync(accountListPath)) fs.mkdirSync(accountListPath);
                tweetAnalyzer.storeTimeLine(accountListPath, classifiedTimeLines);

                console.log(`[FINISHED] Analyzer has finished analyzing & storing twitter data.`);
            }
            catch (e)
            {
                console.error(`[ERR] Could not analyze Tweet Data, because: ${e}`);
                process.exit(1);
            }
        }
    }

    if (process.argv.includes(nodeArgs.neo4j) || process.argv.length === 2)
    {
        console.log(`[IMPORTER] Loading Neo4j configuration file, containing Database information.`);
        let neo4jCfg: Neo4JConfig = {url: 'neo4j://localhost', username: 'neo4j', password: 'password'};
        neo4jCfg = {...Loader.loadJSON(configPath, neo4jCfgFileName, neo4jCfg)};
        Neo4JDriver.createDatabaseConnection(neo4jCfg.url, neo4jCfg.username, neo4jCfg.password);

        console.log(`[IMPORTER] Loading AccountLists...`);
        const accountMap: AccountMap = Loader.loadAccountLists(accountsPath);
        const timeLines: ClassifiedTimeLine[] = [];

        console.log(`[IMPORTER] Storing classified TimeLines in Neo4J Databases.`);

        for (const accountList of Object.keys(accountMap))
        {
            for (const account of accountMap[accountList])
            {

            }
        }
    }
})();
