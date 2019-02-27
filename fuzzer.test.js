it('has a working test harness', () => {
    expect(1).toBe(1);
});

it('allows instantiation of the fuzzer', () => {
    let FuzzMeMaybe = require('./fuzzer');
    let fuzzer = new FuzzMeMaybe();
    expect(fuzzer).toBeInstanceOf(FuzzMeMaybe);
});

it('doesnt fuzz by default', () => {
    let FuzzMeMaybe = require('./fuzzer');
    let fuzzer = new FuzzMeMaybe();
    let input = 'foo';
    fuzzer.setRadamsaSeed('2');
    let result = fuzzer.maybe(input);
    expect(result).toBe(input);
});


it('allows setting of the seed as string or function', () => {
    let FuzzMeMaybe = require('./fuzzer');
    let fuzzer = new FuzzMeMaybe();
    
    let seedString = `${Math.PI}`;
    let seedFunction = () => {
        return Math.PI;
    };

    fuzzer.setRadamsaSeed(seedString);
    expect(fuzzer._fuzzer.options.seed).toBe(seedString);

    fuzzer.setRadamsaSeed(seedFunction);
    expect(fuzzer._fuzzer.options.seed).toBe(seedFunction);
});

describe('Fuzzer input from environment variables:', () => {
    const EXISTING_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env.FUZZER_ENABLED = 1;
    });

    afterEach(() => {
        process.env = EXISTING_ENV;
    });


    it('respects enabled environment variable when fuzzing', () => {
        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        let input = 'foo';
        fuzzer.setRadamsaSeed('3');
        let result = fuzzer.maybe(input);
        expect(result).toBe('fono');
    });

    it('registers boolean flags and respects defaults', () => {
        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        let input = 'foo';
        fuzzer.setRadamsaSeed('3');

        fuzzer.registerFlag('arbitrary_boolean', 'boolean', false);
        
        expect(fuzzer.maybe(input, 'arbitrary_boolean')).toBe('foo');
        expect(fuzzer.maybe(input)).toBe('fono');
    });

    it('registers boolean flags and respects changes on ENV', () => {
        process.env.FUZZER_ARBITRARY_BOOLEAN = "1";

        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        let input = 'foo';
        fuzzer.setRadamsaSeed('3');

        fuzzer.registerFlag('arbitrary_boolean', 'boolean', false);
        expect(fuzzer.maybe(input, 'arbitrary_boolean')).toBe('fono');
        expect(fuzzer.maybe(input)).toBe('fono');
    });

    it('registers skip string flags and respects defaults', () => {
        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        fuzzer.setRadamsaSeed('3');

        let dogInput = "This is DOG";
        let catInput = "This is CAT";
        let pigInput = "This is PIG";


        fuzzer.registerFlag('animal', 'skip_string', 'DOG');
        expect(fuzzer.maybe(dogInput, 'animal')).toBe(dogInput);
        expect(fuzzer.maybe(catInput, 'animal')).toBe('This isn CAT');
        expect(fuzzer.maybe(pigInput)).toBe('This isn PIG');
    });

    it('registers skip string flags and respects ENV', () => {
        process.env.FUZZER_ANIMAL_SKIP_STRING = "CAT";

        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        fuzzer.setRadamsaSeed('3');

        let dogInput = "This is DOG";
        let catInput = "This is CAT";
        let pigInput = "This is PIG";

        fuzzer.registerFlag('animal', 'skip_string', 'DOG');
        expect(fuzzer.maybe(dogInput, 'animal')).toBe('This isn DOG');
        expect(fuzzer.maybe(catInput, 'animal')).toBe('This is CAT');
        expect(fuzzer.maybe(pigInput)).toBe('This isn PIG');
    });

    it('registers skip first flags and respects defaults', () => {
        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        fuzzer.setRadamsaSeed('3');

        let dogInput = "This is DOG";
        let catInput = "This is CAT";
        let pigInput = "This is PIG";

        fuzzer.registerFlag('animal', 'skip_first', 5);
        for (let i=1; i<=6; i++) {
            if (i <= 5) {
                expect(fuzzer.maybe(dogInput, 'animal')).toBe(dogInput);
                expect(fuzzer.maybe(catInput)).toBe('This isn CAT');
            } else {
                expect(fuzzer.maybe(dogInput, 'animal')).toBe('This isn DOG');
            }
        }
        expect(fuzzer.maybe(pigInput)).toBe('This isn PIG');
    });

    it('registers skip first flags and respects ENV', () => {
        let FuzzMeMaybe = require('./fuzzer');
        let fuzzer = new FuzzMeMaybe();
        fuzzer.setRadamsaSeed('3');

        let dogInput = "This is DOG";
        let catInput = "This is CAT";
        let pigInput = "This is PIG";

        fuzzer.registerFlag('animal', 'skip_first', 5);
        for (let i=1; i<=6; i++) {
            if (i <= 5) {
                expect(fuzzer.maybe(dogInput, 'animal')).toBe(dogInput);
                expect(fuzzer.maybe(catInput)).toBe('This isn CAT');
            } else {
                expect(fuzzer.maybe(dogInput, 'animal')).toBe('This isn DOG');
            }
        }
        expect(fuzzer.maybe(pigInput)).toBe('This isn PIG');
    });

});