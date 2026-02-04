module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/?(*.)+(test).ts', '**/?(*.)+(spec|test).ts'],
    moduleNameMapper: {
        '^@arqos/engine/(.*)$': '<rootDir>/$1',
        '^@arqos/utils$': '<rootDir>/../utils/src/index.ts'
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    }
};
