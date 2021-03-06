'use strict'
let immstruct = require('immstruct')
let component = require('omniscient')
let immutable = require('immutable')
let R = require('ramda')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('router')

let layout = require('./layout')
let ajax = require('./ajax')
let userManagement = require('./userManagement')
let Loading = __IS_BROWSER__ ? require('./views/loading') : null
let {normalizePath,} = require('./urlUtils')
let {createRouterState, updateRouterState,} = require('./sharedRouting')
let App = require('./components/app')
let notification = require('./views/notification')

let getState = () => {
  return immstruct('state').cursor()
}

// Get path component of the current URL
let getCurrentPath = () => {
  let link = document.createElement('a')
  link.href = document.location
  return normalizePath(link.pathname)
}

let goTo = (path) => {
  logger.debug(`Navigating to '${path}'`)
  window.history.pushState({}, 'MuzHack', path)
  perform()
}

let redirectIfNecessary = (cursor) => {
  let routerCursor = cursor.cursor('router')
  let routes = routerCursor.get('routes').toJS()
  let route = getCurrentRoute(routes)
  let options = routes[route]
  if (typeof options === 'function') {
    logger.debug(`Route has no options`)
    return
  }

  let loggedInUser = userManagement.getLoggedInUser(cursor)
  if (loggedInUser != null) {
    logger.debug(`User is logged in:`, loggedInUser)
    if (options.redirectIfLoggedIn) {
      let redirectTo = '/'
      logger.debug(`Route requires redirect when logged in - redirecting to ${redirectTo}...`)
      goTo(redirectTo)
    } else {
      logger.debug(`Route doesn't require redirect when logged in`)
      return
    }
  } else {
    logger.debug(`User is not logged in`)
    if (options.redirectIfLoggedOut) {
      let redirectTo = '/'
      logger.debug(`Route requires redirect when logged out - redirecting to ${redirectTo}...`)
      goTo(redirectTo)
    } else {
      if (!options.requiresLogin) {
        logger.debug(`Route doesn't require login`)
        return
      } else  {
        logger.debug(`Route requires user being logged in - redirecting to login page...`)
        goTo('/login')
      }
    }
  }
}

let perform = (isInitial=false) => {
  let cursor = getState()
  let currentPath = getCurrentPath()
  let currentHash = document.location.hash.slice(1).toLowerCase()
  logger.debug(`Routing, current path: '${currentPath}', current hash: '${currentHash}'`)
  let routerState = cursor.cursor('router').toJS()
  if (!isInitial && currentPath === routerState.currentPath) {
    logger.debug(`Path did not change:`, currentPath)
    cursor.cursor('router').set('currentHash', currentHash)
    redirectIfNecessary(cursor)
    return
  }

  let queryStrings = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&')
  let queryParams = R.fromPairs(R.map((elem) => {
    return elem.split('=')
  }, queryStrings))
  logger.debug(`Current query parameters:`, queryParams)
  updateRouterState(cursor, currentPath, queryParams, isInitial)
    .then(([cursor, newState,]) => {
      let mergedNewState = R.merge(newState, {
        router: {
          currentHash,
          isLoading: false,
        },
      })
      logger.debug(`Merging in new state after loading data:`, mergedNewState)
      cursor = cursor.update((current) => {
        current = current.mergeDeep({
          router: {
            currentHash,
            isLoading: false,
          },
        })
        return current.merge(newState)
      })
      redirectIfNecessary(cursor)
    }, (error) => {
      logger.warn(`An error occurred updating router state: ${error}`)
      notification.warn(`Error`, error.message, cursor)
    })
}

if (__IS_BROWSER__) {
  window.onpopstate = () => {
    logger.debug('onpopstate')
    perform()
  }
}

let handleClick = (e) => {
  if (getEventWhich(e) !== 1) {
    return
  }

  if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) {
    return
  }

  // ensure link
  let el = e.target
  while (el && 'A' !== el.nodeName) el = el.parentNode
  if (!el || 'A' !== el.nodeName) {
    return
  }

  // Ignore if tag has
  // 1. "download" attribute
  // 2. rel="external" attribute
  if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') {
    return
  }

  let link = el.getAttribute('href')

  // Check for mailto: in the href
  if (link && link.indexOf('mailto:') > -1) {
    return
  }

  // check target
  if (el.target) {
    return
  }

  // x-origin
  if (!sameOrigin(el.href)) {
    return
   }

  // rebuild path
  let path = el.pathname + el.search + (el.hash || '')

  // strip leading "/[drive letter]:" on NW.js on Windows
  if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
    path = path.replace(/^\/[a-zA-Z]:\//, '/')
  }

  // same page
  let orig = path
  let basePath = ''

  if (path.indexOf(basePath) === 0) {
    path = path.substr(basePath.length)
  }

  if (basePath && orig === path) {
    return
  }

  logger.debug(`Handling link click`)
  e.preventDefault()
  goTo(orig)
}

if (__IS_BROWSER__) {
  let clickEvent = document != null && document.ontouchstart ? 'touchstart' : 'click'
  document.addEventListener(clickEvent, handleClick, false)
}

let getEventWhich = (e) => {
  e = e || window.event
  return e.which == null ? e.button : e.which
}

/**
 * Check if `href` is the same origin.
 */
let sameOrigin = (href) => {
  let origin = location.protocol + '//' + location.hostname
  if (location.port) {
    origin += ':' + location.port
  }
  return href != null && (0 === href.indexOf(origin))
}

let Router = component('Router', (cursor) => {
  logger.debug('Router rendering')
  logger.debug('Current state:', cursor.toJS())
  return App(cursor)
})

let getCurrentRoute = (routes) => {
  let path = getCurrentPath()
  let route = R.find((route) => {
    return new RegExp(route).test(path)
  }, R.keys(routes))
  if (route == null) {
    throw new Error(`Couldn't find route corresponding to path '${path}'`)
  }
  return route
}

module.exports = {
  Router,
  performInitial: (cursor, routeMap) => {
    cursor.mergeDeep({
      router: createRouterState(routeMap),
    })
    perform(true)
  },
  perform,
  goTo,
}
