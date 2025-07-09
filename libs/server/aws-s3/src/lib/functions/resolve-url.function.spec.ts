import { TS3Params } from "../services/s3.service";
import { resolveUrl } from "./resolve-url.function";

const region: string = 'us-east-2';

describe('resolveUrl', () => {
    it.each([
        [{ Bucket: 'with-slash', Key: 'item.pdf' }],
        [{ Bucket: 'with.dot', Key: 'item.pdf' }],
    ])('', ({ Bucket, Key }: TS3Params) => {
        expect(resolveUrl(region, { Bucket, Key })).toMatchSnapshot();
    });
});