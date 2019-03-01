"use strict";

const Sinkdweller = require('sinkdweller');
const chalk       = require('chalk');

const ENV_TYPE = {
    BOOLEAN: 1, 
    STRING:  2,
    NUMBER:  3
};

const FLAG_TYPE = {
    BOOLEAN:     'BOOLEAN',
    SKIP_STRING: 'SKIP_STRING',
    SKIP_FIRST:  'SKIP_FIRST'
};

const DEFAULT_OPTIONS = {
    environmentPrefix: 'FUZZER_',
    enableFlag: 'ENABLED',
    enableByDefault: false,
    showIOByDefault: false
};


class Fuzzer {

    constructor(options) {
        this.options = Object.assign({}, DEFAULT_OPTIONS);
        if (typeof options !== 'undefined') {
            this.options = Object.assign(this.options, options);
        }

        // establish fuzzer context
        this._fuzzer = new Sinkdweller();

        // set up internal structures
        this.flags = {};
        this.skips = {};
    }


    /**
     * (Maybe) fuzz the data contained in strbufData
     * @param {string|Buffer} strbufData The string/buffer for this data
     * @param {string} strDataKey A key for this data. Allows for scoping fuzzing conditionals.
     */
    maybe(strbufData, strDataKey) {
        if (typeof strDataKey !== 'undefined') {
            strDataKey = strDataKey.toUpperCase();
        }

        this._showIOMaybe('in', strbufData);
        if (this._shouldFuzz(strDataKey, strbufData)) {
            strbufData = this._fuzzer.fuzzSync(strbufData);
        }
        this._showIOMaybe('out', strbufData);
        return strbufData;
    }


    /**
     * Registers a new environment variable prefix for this
     * fuzzer. Useful to scope different fuzzers. 
     * 
     * @param {String} strPrefix The prefix to set
     */
    registerEnvironmentPrefix(strPrefix) {
        if (typeof strPrefix !== 'string') {
            throw new Error(`registerEnvironmentPrefix must be a string`);
        }
        this.options.environmentPrefix = strPrefix.toUpperCase();
    }
    

    /**
     * Register an environment flag with the fuzzer. 
     * 
     * @param {String} strDataKey The name for the flag. Will be normalized to uppercase.
     * @param {String} enFlagType A string of FLAG_TYPE.
     * @param {any} defaultValue Flag type-specific data value. See README.
     */
    registerFlag(strDataKey, enFlagType, defaultValue) {
        if (typeof strDataKey === 'undefined') {
            throw new Error(`registerFlag: flag name is required`);
        }
        if (typeof enFlagType === 'undefined') {
            throw new Error(`registerFlag: flag type is required`);
        }

        // normalize values
        enFlagType  = enFlagType.trim().toUpperCase();
        strDataKey  = strDataKey.trim().toUpperCase();
        let flagKey = strDataKey + '::' + enFlagType;

        if (!Object.values(DEFAULT_OPTIONS).indexOf(enFlagType)) {
            throw new Error(`registerFlag: invalid flag type ${enFlagType}`);
        }
        if (!Object.keys(this.flags).indexOf(flagKey)) {
            throw new Error(`registerFlag: flag ${flagKey} already registered.`);
        }

        // create a flag object to store
        let envName = strDataKey;
        if (enFlagType !== FLAG_TYPE.BOOLEAN) {
            envName += '_' + enFlagType;
        }
        let f = {
            'env':          envName,
            'datakey':      strDataKey,
            'type':         enFlagType,
            'env_type':     this._getEnvTypeForFlagType(enFlagType),
            'default':      defaultValue
        };
        this.flags[flagKey] = f;

        // add to skips if this is a 'skip' type flag
        if (enFlagType === 'SKIP_FIRST') {
            this.skips[flagKey] = 0;
        }
    }


    /**
     * Set the seed value or function of the Radamsa fuzzer.
     * 
     * @param {String|Function} seedValueOrFunction A seed value or function
     */
    setRadamsaSeed(seedValueOrFunction) {
        let type = (typeof seedValueOrFunction);
        if (!(type === 'string' || type === 'function')) {
            throw new Error(`setRadamsaSeed: Seed must be of type string or function`);
        }
        this._fuzzer.setSeed(seedValueOrFunction);
    }
    

    /**
     * Show IO to a stdout/stderr if enabled.
     * 
     * @param {String} type Caption string (e.g.' 'in', 'out')
     * @param {String|Buffer} strbufData Data for IO
     */
    _showIOMaybe(type, strbufData) {
        let showIO = this._getEnvironmentVariable('SHOW_IO', ENV_TYPE.BOOLEAN);
        if (showIO === null) {
            showIO = this.options.showIOByDefault;
        }
        if (showIO) {
            let showAsStdErr = this._getEnvironmentVariable('SHOW_IO_STDERR', ENV_TYPE.BOOLEAN);
            if (showAsStdErr === null) {
                showAsStdErr = false;
            }
            let output = showAsStdErr ? console.error : console.info;
            let dataIsBuffer = Buffer.isBuffer(strbufData);
            let bufferDisclaimer = dataIsBuffer ? ' [encoded Buffer]' : '';
            output(chalk.gray(type) + isBuffer + ":");
            if (dataIsBuffer) {
                output(chalk.white(strbufData.toString('base64')));
            } else {
                output(chalk.white(strbufData));
            }
            output(chalk.gray("-------------"));
        }
    }

    
    /**
     * Whether or not data with the key `strDataKey` should be fuzzed.
     * 
     * @param {String} strDataKey A data key used to filter flags.
     * @param {String|Buffer} value The value being fuzzed.
     * @returns A boolean value on whether or not this data should be fuzzed.
     */
    _shouldFuzz(strDataKey, value) {
        // check global flag before continuing
        let enableFlagValue = this._getEnvironmentVariable(this.options.enableFlag, ENV_TYPE.BOOLEAN);
        
        if (enableFlagValue === null) {
            enableFlagValue = this.options.enableByDefault;
        }
        if (enableFlagValue === false) {
            // short circuit if the fuzzer is not enabled
            return false;
        }

        // short-circuit if there is no scope
        if (typeof strDataKey === 'undefined') return true;


        // change the value of value if 
        // conditional returns true
        // and value is true.
        let spoil = function(value, conditional) {
            if (conditional === true && value === true) {
                return false;
            }
            return value;
        };

        // we will fuzz by default unless something tells us otherwise
        let maybe = true;

        // check through all flags for failure conditions
        for (let key in this.flags) {
            let flag = this.flags[key];
            
            // if this flag is inapplicable for this key, move on
            if (strDataKey !== flag.datakey) {
                continue;
            }

            let envValue = this._getEnvironmentVariable(flag.env, flag.env_type);
            if (envValue === null) {
                envValue = flag.default;
            }

            switch(flag.type) {
                
                // boolean flags turn off if false
                case (FLAG_TYPE.BOOLEAN):
                    maybe = spoil(maybe, (envValue === false));
                    break;
                
                // skip string skips if we see this string in the value
                case (FLAG_TYPE.SKIP_STRING):
                    maybe = spoil(maybe, (value.indexOf(envValue) >= 0));
                    break;
                
                // skip first skips if this.skips for this context isn't triggered
                case (FLAG_TYPE.SKIP_FIRST):
                    let amountSkipped = this.skips[key];
                    maybe = spoil(maybe, (amountSkipped < envValue));
                    this.skips[key]++;
                    break;
            }
        }

        return maybe;
    }


    /**
     * Get an environment variable from the process. Returns `null` if
     * the variable is nonexistent. 
     * 
     * @param {String} strEnvironmentKey The environment variable key
     * @param {VAR_TYPE} enVarType Internal variable type.
     */
    _getEnvironmentVariable(strEnvironmentKey, enVarType) {
        strEnvironmentKey = strEnvironmentKey.toUpperCase();
        let key = this.options.environmentPrefix + strEnvironmentKey;
        if (Object.keys(process.env).indexOf(key) === -1) {
            return null;
        }
        
        let result;
        switch (enVarType) {
            case ENV_TYPE.BOOLEAN:
                result = process.env[key].toLowerCase();
                if (result === '0' || result === '1') {
                    result = (result === '1');
                }
                else if (result === 'true' || result === 'false') {
                    result = (result === 'true')
                }
                else {
                    throw new Error(`Expected boolean but got incorrect value for environment variable ${key} (value: ${result})`);
                }
                return result;
            case ENV_TYPE.STRING:
                return process.env[key];
            case ENV_TYPE.NUMBER:
                result = parseInt(process.env[key]);
                if (isNaN(result)) {
                    throw new Error(`Expected number but got NaN for environment variable ${key} (value ${process.env[strEnvironmentKey]})`);
                }
                return result;
            default:
                throw new Error(`Unsupported enVarType ${enVarType}`);
        }
    }

    /**
     * Coerce a FLAG_TYPE into an expected variable type we pull from the environment 
     * variables in `process.env.`
     * 
     * @param {FLAG_TYPE|String} enFlagType 
     */
    _getEnvTypeForFlagType(enFlagType) {
        switch(enFlagType) {
            case FLAG_TYPE.BOOLEAN:
                return ENV_TYPE.BOOLEAN;
            case FLAG_TYPE.SKIP_FIRST:
                return ENV_TYPE.NUMBER;
            case FLAG_TYPE.SKIP_STRING:
                return ENV_TYPE.STRING;
            default:
                throw new Error(`Cannot get env type for flag type ${enFlagType}`);
        }
    }

}

exports = module.exports = Fuzzer;