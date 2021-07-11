import {TimeLine} from '../crawler/TimeLine';
import {User} from '../crawler/User';
import {ClassifiedTweet} from './ClassifiedTweet';

export class ClassifiedTimeLine extends TimeLine
{
    public tweets: ClassifiedTweet[] = [];

    constructor(user: User, tweets: ClassifiedTweet[])
    {
        super(user, tweets);
    }

    public add(tweet: ClassifiedTweet): void
    {
        this.tweets.push(tweet);
    }
}
