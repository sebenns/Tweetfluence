import * as path from 'path';
import {crawler} from './crawler';
import {analyzer} from './analyzer';
import {importer} from './importer';

console.log("[RUN] Starting Twittfluence Application. Locating necessary input artefacts and folder...");

// root path, containing src, data & config
const root = path.resolve(__dirname, '..');

// folder paths for data, config, accounts, ...
const folder: { data, config, accounts } = {
    data    : path.resolve(root, 'data'),
    config  : path.resolve(root, 'config'),
    accounts: path.resolve(root, 'config', 'accounts'),
}

// raw-tweets & tweets paths
const storage: { rawTweets, tweets } = {
    rawTweets: path.resolve(folder.data, 'raw-tweets'),
    tweets   : path.resolve(folder.data, 'tweets'),
}

// configuration files
const config: { twitter, google, neo4j } = {
    twitter: 'twitter.cfg.json',
    google : 'twittfluence.cfg.json',
    neo4j  : 'neo4j.cfg.json',
}

// node arguments
const nodeArgs = {
    crawl    : '--crawl',
    sentiment: '--analyze',
    neo4j    : '--neo4j',
    skip     : '--skip',
};

(async () =>
{
    if (process.argv.includes(nodeArgs.crawl) || isStartCmd()) await crawler(folder, storage, config);
    if (process.argv.includes(nodeArgs.sentiment) || isStartCmd()) await analyzer(folder, storage, config);
    if (process.argv.includes(nodeArgs.neo4j) || isStartCmd()) await importer(folder, storage, config);

    process.exit(0);
})();

function isStartCmd(): boolean
{
    return process.argv.length === 2 || (process.argv.length === 3 && process.argv.includes(nodeArgs.skip))
}
