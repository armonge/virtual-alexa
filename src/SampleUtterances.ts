import * as fs from "fs";
import * as Path from "path";
import {BuiltinUtterances} from "./BuiltinUtterances";

export class SampleUtterances {
    public static fromFile(file: string): SampleUtterances {
        const data = fs.readFileSync(file);
        const utterances = new SampleUtterances();
        utterances.parseFlatFile(data.toString());
        return utterances;
    }

    public static fromJSON(sampleUtterancesJSON: any): SampleUtterances {
        const sampleUtterances = new SampleUtterances();
        for (const intent of Object.keys(sampleUtterancesJSON)) {
            for (const sample of sampleUtterancesJSON[intent]) {
                sampleUtterances.addSample(intent, sample);
            }
        }
        return sampleUtterances;
    }

    private samples: {[id: string]: SamplePhrase[]} = {};

    public constructor() {
        const builtinValues = BuiltinUtterances.values();
        // We add each phrase one-by-one
        // It is possible the built-ins have additional samples defined
        for (const key of Object.keys(builtinValues)) {
            for (const phrase of builtinValues[key]) {
                this.addSample(key, phrase);
            }
        }
    }

    public addSample(intent: string, sample: string) {
        if (!(intent in this.samples)) {
            this.samples[intent] = [];
        }
        this.samples[intent].push(new SamplePhrase(intent, sample));
    }

    public samplesForIntent(intent: string): SamplePhrase [] {
        return this.samples[intent];
    }

    /**
     * To handle the case when what is said does not match any sample utterance
     */
    public defaultUtterance(): SamplePhrase {
        // Just grab the first sample for now
        const firstIntent = Object.keys(this.samples)[0];
        return this.samples[firstIntent][0];
    }

    private parseFlatFile(fileData: string): void {
        const lines = fileData.split("\n");
        for (const line of lines) {
            if (line.trim().length === 0) {
                // We skip blank lines - which is what Alexa does
                continue;
            }

            const index = line.indexOf(" ");
            if (index === -1) {
                throw Error("Invalid sample utterance: " + line);
            }

            const intent = line.substr(0, index);
            const sample = line.substr(index).trim();
            this.addSample(intent, sample);
        }
    }
}

/**
 * Helper class for handling phrases - breaks out the slots within a phrase
 */
export class SamplePhrase {
    private slotNames: string[] = [];
    private regex: string;

    public constructor(public intent: string, public phrase: string) {
        this.phrase = phrase.toLowerCase();
        this.regex = this.phraseToRegex(this.phrase);
    }

    public slotName(index: number): string | undefined {
        if (index >= this.slotNames.length) {
            return undefined;
        }

        return this.slotNames[index];
    }

    public slotCount(): number {
        return this.slotNames.length;
    }

    /**
     * Tests to see if the utterances matches the sample phrase
     * If it does, returns an array of matching slot values
     * If it does not, returns undefined
     * @param {string} utterance
     * @returns {[]}
     */
    public matchesUtterance(utterance: string): string[] | undefined {
        // Take out any special characters
        const cleanUtterance = utterance.replace(/[^a-zA-Z ]/g, "");
        const match = cleanUtterance.match(this.regex);
        console.log("RegEx: " + this.regex);
        let result: string[] | undefined;
        if (match) {
            result = match.slice(1);
        }
        return result;
    }

    /**
     * Takes a phrase like "This is a {Slot}" and turns it into a regex like "This is a(.*)"
     * This is so we can compare the sample utterances (which have names that tie off to the slot names defined in the
     *  intent schema) with the actual utterance, which have values in the slot positions (as opposed to the names)
     * @param phrase
     */
    private phraseToRegex(phrase: string): string {
        const startIndex = phrase.indexOf("{");
        if (startIndex !== -1) {
            const endIndex = phrase.indexOf("}", startIndex);
            this.slotNames.push(phrase.substring(startIndex + 1, endIndex));
            phrase = phrase.substring(0, startIndex).trim() + "(.*)" + phrase.substring(endIndex + 1).trim();
            phrase = this.phraseToRegex(phrase);
        }
        return phrase;
    }
}
