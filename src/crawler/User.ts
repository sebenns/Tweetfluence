export class User
{
    public readonly id: string;
    public readonly account: string;

    constructor(id: string, account: string)
    {
        this.id = id;
        this.account = account;
    }
}
