import * as fs from 'fs';
import * as path from 'path';

export interface AccountMap
{
    [key: string]: string[];
}

export class Loader
{
    /**
     * Loads accountLists from accountListPath. Every list name will be mapped to it's content as string[].
     * @param {string} accountsPath AccountsPath containing all accountLists
     * @returns {{[key: string]: string[]}} AccountListMap, AccountListName -> AccountList
     */
    public static loadAccountLists(accountsPath: string): AccountMap
    {
        try
        {
            const accountLists: string[] = fs.readdirSync(accountsPath).filter(s => s.endsWith('.txt'));
            const accountMap: { [key: string]: string[] } = {};

            for (const accountList of accountLists)
            {
                const accountListPath = path.resolve(accountsPath, accountList);
                console.log(`[LOADER] Loading contents of ${accountList} in accountList path.`);

                const contents: string = fs.readFileSync(accountListPath).toString();
                const accounts: string[] = contents.split(/[\r\n]+/).filter(s => s !== "");
                accountMap[accountList.split('.')[0]] = accounts;

                console.log(`[LOADER] Found ${accounts.length} user(s) in ${accountList}.`);
            }

            return accountMap;
        }
        catch (e)
        {
            console.error(`[ERR] Loading accounts failed, because an error occurred: ${e.message}`);
            process.exit(1);
        }
    }

    /**
     * Load JSON File by provided JSONPath, FileName & generic initialState
     * @param {string} JSONPath File path, where to find it
     * @param {string} JSONFileName File Name, to find in JSONPath
     * @param {T} initialState Generic state of file to create, if it does not exist
     * @returns {T} Data if found, parsed to json
     */
    public static loadJSON<T>(JSONPath: string, JSONFileName: string, initialState: T = null): T
    {
        const JSONFilePath = path.resolve(JSONPath, JSONFileName);

        try
        {
            console.log(`[LOADER] Checking for JSON file: ${JSONFileName}`);

            if (!fs.existsSync(JSONFilePath))
            {
                if (!initialState) throw Error(`JSON file not found for ${JSONFileName}.`);
                fs.writeFileSync(JSONFilePath, JSON.stringify(initialState, null, 4));
                throw Error(`JSON file not found, but created: ${JSONFilePath}`);
            }

            console.log(`[LOADER] Found JSON file: ${JSONFileName}.`);
            return JSON.parse(fs.readFileSync(JSONFilePath).toString());
        }
        catch (e)
        {
            console.error(`[ERR] Loading JSON file failed, because an error occurred: ${e.message}`);
            process.exit(1);
        }
    }
}
