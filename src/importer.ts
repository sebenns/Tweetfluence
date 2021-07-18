import {Neo4JConfig, Neo4JDriver} from './importer/Neo4JDriver';
import {AccountMap, Loader} from './utils/Loader';
import {Importer} from './importer/Importer';
import {ClassifiedTimeLine} from './analyzer/ClassifiedTimeLine';
import * as path from 'path';

export const importer = async (folder, storage, config) =>
{
    console.log(`[IMPORTER] Loading Neo4j configuration file, containing Database information.`);
    let neo4jCfg: Neo4JConfig = {url: 'neo4j://localhost', username: 'neo4j', password: 'password'};
    neo4jCfg = {...Loader.loadJSON(folder.config, config.neo4j, neo4jCfg)};
    Neo4JDriver.createDatabaseConnection(neo4jCfg.url, neo4jCfg.username, neo4jCfg.password);

    console.log(`[IMPORTER] Loading AccountLists...`);
    const accountMap: AccountMap = Loader.loadAccountLists(folder.accounts);
    const importer: Importer = new Importer();
    await importer.cleanDB();

    for (const accountList of Object.keys(accountMap))
    {
        const timeLines: ClassifiedTimeLine[] = [];

        for (const account of accountMap[accountList])
        {
            const accountListPath = path.resolve(storage.tweets, accountList);
            const content: ClassifiedTimeLine = Loader.loadJSON(accountListPath, `${account}.json`);
            timeLines.push(content as ClassifiedTimeLine);

            console.log(`[IMPORTER] Loaded classified TimeLine for ${account}.`);
        }

        console.log(`[IMPORTER] Importing data for ${accountList} in Neo4J Database.`);

        try
        {
            for (const timeLine of timeLines) await importer.importTimeLine(timeLine);
        }
        catch (e)
        {
            console.error(`[ERR] Could not analyze Tweet Data, because: ${e.message}`);
            process.exit(1);
        }
    }

    await importer.afterImport();
    console.log(`[FINISHED] All classified TimeLines had been imported to Neo4J Database.`);
}
