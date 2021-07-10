import language, {LanguageServiceClient} from '@google-cloud/language';
import {TimeLine} from '../crawler/TimeLine';
import {google} from '@google-cloud/language/build/protos/protos';
import {ClassifiedTweet} from './ClassifiedTweet';
import {ClassifiedTimeLine} from './ClassifiedTimeLine';
import * as path from 'path';
import * as fs from 'fs';
import IDocument = google.cloud.language.v1beta2.IDocument;
import IFeatures = google.cloud.language.v1beta2.AnnotateTextRequest.IFeatures;

export class TweetAnalyzer
{
    private client: LanguageServiceClient;

    constructor()
    {
        this.client = new language.LanguageServiceClient();
    }

    /**
     * Analyzes provided Twitter timeLine by using the Google Cloud NLP API
     * @param {TimeLine} timeLine TimeLine object to analyze, converting it into a classifiedTimeLine
     * @returns {Promise<ClassifiedTimeLine>} ClassifiedTimeline, containing Tweets, which are analyzed by Google NLP API
     */
    public async analyzeTimeLine(timeLine: TimeLine): Promise<ClassifiedTimeLine>
    {
        const classifiedTimeLine: ClassifiedTimeLine = new ClassifiedTimeLine(timeLine.user, []);

        for (const tweet of timeLine.tweets)
        {
            const document: IDocument = {
                content : tweet.text,
                type    : 'PLAIN_TEXT',
                language: 'en'
            };

            const features: IFeatures = {
                extractSyntax           : false,
                extractEntities         : true,
                extractDocumentSentiment: true,
                classifyText            : true,
            };

            const [result] = await this.client.annotateText({document, features});

            const classifiedTweet: ClassifiedTweet = new ClassifiedTweet(tweet);
            classifiedTweet.setAnalyzedData(result);
            classifiedTimeLine.add(classifiedTweet);

            console.log(`[x] Tweet ${tweet.id} has been analyzed.`);
        }

        console.log(`[ANALYZED] Finished TimeLine for ${timeLine.user.account}.`);
        return classifiedTimeLine;
    }

    public storeTimeLine(tweetsPath: string, timeLines: ClassifiedTimeLine[]): void
    {
        for (const timeLine of timeLines)
        {
            const userFile = path.resolve(tweetsPath, `${timeLine.user.account}.json`);
            fs.writeFileSync(userFile, JSON.stringify(timeLine, null, 4));
        }
    }
}
