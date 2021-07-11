import neo4j, {Driver} from 'neo4j-driver';

export interface Neo4JConfig
{
    url: string;
    username: string;
    password: string;
}

export class Neo4JDriver
{
    public static instance: Driver;

    public static createDatabaseConnection(url: string, username: string, password: string): Driver
    {
        this.instance = neo4j.driver(url, neo4j.auth.basic(username, password));
        return this.instance;
    }
}
