import * as path from 'path';
import * as fs from 'fs';
import {AccountMap, Loader} from './utils/Loader';
import {TimeLine} from './crawler/TimeLine';
import {TweetAnalyzer} from './analyzer/TweetAnalyzer';
import {ClassifiedTimeLine} from './analyzer/ClassifiedTimeLine';

export const analyzer = async (folder, storage, config) =>
{
    try
    {
        console.log(`[ANALYZER] Setting up configuration file  ${config.google} as env variable.`);
        const googleCfgPath = path.resolve(folder.config, config.google);

        if (!fs.existsSync(googleCfgPath)) throw Error(`File not found: ${googleCfgPath}`);
        process.env['GOOGLE_APPLICATION_CREDENTIALS'] = googleCfgPath;
    }
    catch (e)
    {
        console.error(`[ERR] Could not start Tweet Analyzer, because: ${e.message}`);
        process.exit(1);
    }

    console.log(`[ANALYZER] Loading AccountLists...`);
    const accountMap: AccountMap = Loader.loadAccountLists(folder.accounts);

    for (const accountList of Object.keys(accountMap))
    {
        const accountListPath = path.resolve(storage.tweets, accountList);

        if (process.argv.includes('--skip'))
        {
            console.log(`[ANALYZER] Skip Flag has been set, skipping already crawled accounts.`);
            accountMap[accountList] = accountMap[accountList].filter(a => !fs.existsSync(path.resolve(accountListPath, `${a}.json`)));
        }

        const timeLines: TimeLine[] = [];

        for (const account of accountMap[accountList])
        {
            const accountListPath = path.resolve(storage.rawTweets, accountList);
            const content: TimeLine = Loader.loadJSON(accountListPath, `${account}.json`);
            timeLines.push(content as TimeLine);

            console.log(`[ANALYZER] Loaded TimeLine for ${account}.`);
        }

        try
        {
            const tweetAnalyzer: TweetAnalyzer = new TweetAnalyzer();
            const classifiedTimeLines: ClassifiedTimeLine[] = [];

            for (const timeLine of timeLines) classifiedTimeLines.push(await tweetAnalyzer.analyzeTimeLine(timeLine));
            if (!fs.existsSync(accountListPath)) fs.mkdirSync(accountListPath);
            tweetAnalyzer.storeTimeLine(accountListPath, classifiedTimeLines);

            console.log(`[ANALYZER] Stored analyzed twitter data for ${accountList}.`);
        }
        catch (e)
        {
            console.error(`[ERR] Could not analyze Tweet Data, because: ${e.message}`);
            process.exit(1);
        }
    }

    console.log(`[FINISHED] Analyzer has finished analyzing & storing twitter data.`);
}
