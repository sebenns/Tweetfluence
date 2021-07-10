import {Tweet} from '../crawler/Tweet';
import {google} from '@google-cloud/language/build/protos/protos';
import IAnnotateTextResponse = google.cloud.language.v1beta2.IAnnotateTextResponse;
import IClassificationCategory = google.cloud.language.v1beta2.IClassificationCategory;
import IEntity = google.cloud.language.v1beta2.IEntity;
import ISentiment = google.cloud.language.v1beta2.ISentiment;

export class ClassifiedTweet extends Tweet
{
    public sentiment: ISentiment;
    public entities: IEntity[] = [];
    public categories: IClassificationCategory[] = [];
    public language: string;

    constructor(tweetData: Tweet)
    {
        super(tweetData.id);
        this.text = tweetData.text;
        this.created = tweetData.created;
        this.replies = tweetData.replies;
        this.likes = tweetData.likes;
        this.retweets = tweetData.retweets;
        this.quotes = tweetData.quotes;
    }

    public setAnalyzedData(data: IAnnotateTextResponse): void
    {
        this.sentiment = data.documentSentiment;
        this.language = data.language;
        this.entities = data.entities;
        this.categories = data.categories;
    }
}
