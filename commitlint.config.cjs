module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting, no code change
        'refactor', // Refactor, no feature/fix
        'test',     // Tests
        'ci',       // CI/CD
        'chore',    // Build, deps, tooling
        'revert',   // Revert a commit
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
