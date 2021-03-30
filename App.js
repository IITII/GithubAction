/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2021/03/30 11:28
 */
'use strict'
const TOKEN = process.env.AC_TOKEN || '',
  LOGGER = process.env.AC_LOGGER || 'info',
  repo = process.env.AC_REPO || 'jd',
  duplicateFile = process.env.AC_DU || './id.json'

const fs = require('fs'),
  {Octokit} = require("@octokit/core"),
  octokit = new Octokit({
    auth: TOKEN,
    log: require("console-log-level")({level: LOGGER || 'error'})
  })

function check() {
  if (TOKEN === '') {
    throw new Error('TOKEN can not be empty!')
  }
}

async function getOwner() {
  console.log(new Date())
  return await octokit.request('GET /user')
    .then(res => {
      octokit.log.debug(res.data)
      return res.data.login
    })
}


async function getAllWorkflows(owner, repo, page = 1, per_page = 100, status = 'completed') {
  return await new Promise(resolve => {
    getWorkflows(owner, repo, page, per_page, status)
      .then(async res => {
        const n = res.total_count,
          works = res.workflow_runs
        if (page === 1) {
          octokit.log.info(`Total workflow count: ${n}`)
        }
        octokit.log.info(`Getting page: ${page}`)
        if (works.length < per_page) {
          return resolve(works)
        } else {
          const nextPage = page + 1
          getAllWorkflows(owner, repo, nextPage, per_page, status)
            .then(recursion => {
              return resolve(Array.isArray(recursion) ? recursion.concat(works) : works)
            })
        }
      })
      .catch(e => {
        octokit.log.error(e)
        return resolve([])
      })
  })
}

async function getWorkflows(owner, repo, page, per_page, status) {
  return await octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
    status, owner, repo, page, per_page
  })
    .then(res => res.data)
    .catch(e => e)
}

async function deleteWorkflowRunLogs(owner, repo, run_id) {
  return await octokit.request('DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs', {
    owner, repo, run_id
  })
    .then(res => res.data)
    .catch(e => e)
}

async function deleteAllWorkflowRunLogs(owner, repo, workflows) {
  const arr = [].concat(workflows)
  arr.map(_ => deleteWorkflowRunLogs(owner, repo, _.id))
  return await Promise.allSettled(arr)
    .then(status => {
      return {
        success: status.filter(_ => _.status === 'fulfilled'),
        failed: status.filter(_ => _.status !== 'fulfilled')
      }
    })
}

(async _ => {
  // check
  check()

  const owner = await getOwner(),
    conclusionDelete = 'success'

  getAllWorkflows(owner, repo)
    .then(res => {
      return res.map(_ => {
        return {
          id: _.id,
          name: _.name,
          status: _.status,
          conclusion: _.conclusion,
          workflow_id: _.workflow_id
        }
      })
    })
    .then(res => {
      try {
        // remove duplicate
        const arr = []
        if (fs.existsSync(duplicateFile)) {
          const set = new Set(JSON.parse(fs.readFileSync(duplicateFile).toString()))
          res.forEach(o => set.has(o.id) ? null : arr.push(o))
          fs.writeFileSync(duplicateFile, JSON.stringify([...set].concat([].concat(arr).map(_ => _.id))))
          return arr
        }
        fs.writeFileSync(duplicateFile, JSON.stringify([].concat(arr).map(_ => _.id)))
        return arr.concat(res)
      } catch (e) {
        octokit.log.error(e)
        fs.unlinkSync(duplicateFile)
      }
      return res
    })
    .then(res => {
      return {
        delete: res.filter(_ => _.conclusion === conclusionDelete),
        others: res.filter(_ => _.conclusion !== conclusionDelete)
      }
    })
    .then(res => {
      octokit.log.warn(`Need more details:  ${res.others}`)
      deleteAllWorkflowRunLogs(owner, repo, res.delete)
        .then(r => {
          octokit.log.debug(r)
          octokit.log.info(`Workflow logs delete successful:  ${r.hasOwnProperty('success') && r.success.length} `)
          octokit.log.info(`Workflow logs delete failed:  ${r.failed || []} `)
        })
    })
})()
