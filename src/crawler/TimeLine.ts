import {User} from './User';
import {Tweet} from './Tweet';

export class TimeLine
{
    public readonly user: User;
    public readonly tweets: Tweet[];
    public readonly language: string;

    constructor(user: User, tweets: Tweet[])
    {
        this.user = user;
        this.tweets = tweets;
    }
}
