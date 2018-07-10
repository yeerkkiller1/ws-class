import { createPromiseStream, setDefaultTimeout } from "./promise";
import { throwsAsync } from "../reflection/assert";
import { g } from "../reflection/misc";

describe("throws", () => {
    it("throws on timeout", async () => {
        let test = createPromiseStream<void>();

        await throwsAsync(async () => {
            await test.getPromise();
        });
    });
});