import {TweetConfig, TweetCrawler} from './crawler/TweetCrawler';
import {AccountMap, Loader} from './utils/Loader';
import * as path from 'path';
import * as fs from 'fs';

export const crawler = async (folder, storage, config) =>
{
    console.log(`[CRAWLER] Loading Twitter configuration file, containing API information.`);
    let twitterCfg: TweetConfig = {apiKey: '', apiSecretKey: '', bearerToken: '', maxAmount: 0};
    twitterCfg = {...Loader.loadJSON(folder.config, config.twitter, twitterCfg)};

    console.log(`[CRAWLER] Loading AccountLists...`);
    const accountMap: AccountMap = Loader.loadAccountLists(folder.accounts);

    for (const accountList of Object.keys(accountMap))
    {
        const accountListPath = path.resolve(storage.rawTweets, accountList);

        if (process.argv.includes('--skip'))
        {
            console.log(`[CRAWLER] Skip Flag has been set, skipping already crawled accounts.`);
            accountMap[accountList] = accountMap[accountList].filter(a => !fs.existsSync(path.resolve(accountListPath, `${a}.json`)));
        }

        console.log(`[CRAWLER] Crawling TimeLines for ${accountList} AccountList.`);
        const tweetCrawler: TweetCrawler = new TweetCrawler(twitterCfg);

        for (const name of accountMap[accountList]) await tweetCrawler.createTwitterUserBy(name);
        for (const user of tweetCrawler.userList) await tweetCrawler.crawlTimeLineFor(user);

        try
        {
            if (!fs.existsSync(accountListPath)) fs.mkdirSync(accountListPath);
            tweetCrawler.storeTwitterData(accountListPath);
            console.log(`[CRAWLER] Stored raw twitter data for ${accountList}.`);
        }
        catch (e)
        {
            console.error(`[ERR] Could not store twitter data, because: ${e.message}`);
            process.exit(1);
        }
    }

    console.log(`[FINISHED] Crawler has finished crawling & storing twitter data.`);
}
