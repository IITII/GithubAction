# Github Action

### Remove all `success` workflow logs

* Base
  on: [https://docs.github.com/en/rest/reference/actions#workflows](https://docs.github.com/en/rest/reference/actions#workflows)
* Run
  * Git Clone
  * `npm i`
  * `npm start`

|    ENV    |    Description     |   Default   |
| :-------: | :----------------: | :---------: |
| AC_TOKEN  |    Github token    |     ''      |
| AC_LOGGER |    Logger Level    |   'info'    |
|  AC_REPO  |     Repo name      |    'jd'     |
|   AC_DU   | File for duplicate | './id.json' |
