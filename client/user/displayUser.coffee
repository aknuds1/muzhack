logger = new Logger("displayUser")

getActiveTab = ->
  Iron.controller().state.get("activeTab")

isActiveTab = (tabName) ->
  getActiveTab() == tabName

class UserTab
  constructor: (@title, @icon) ->
    @name = @title.toLowerCase()

  classes: ->
    if isActiveTab(@name)
      logger.debug("#{@name} is active tab")
      "active"
    else
      ""

Template.user.helpers({
  profileTabs: ->
    logger.debug("Getting profile tabs")
    [new UserTab("Projects"), new UserTab("Planned"),]
  displayProjects: -> isActiveTab("projects")
  displayPlanned: -> isActiveTab("planned")
  hasProjects: -> Projects.findOne({owner: @username})?
  projects: -> Projects.find({owner: @username})
  hasPlannedProjects: -> TrelloBoards.findOne({username: @username})?
  plannedProjects: -> TrelloBoards.find({username: @username})
})
Template.user.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
  "click #create-plan": ->
    logger.debug("Button for creating project plan clicked")
    modalService.showModal("createPlan", "Create Plan", {}, {
      ok: (inputValues) ->
        logger.debug("User OK-ed creating plan", inputValues)
        invokeTrelloApi("createTrelloBoard", (error, result) ->
          if error?
            logger.warn("Server failed to create Trello board:", error)
            notificationService.warn("Error",
              "Server failed to create Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully create Trello board")
        , inputValues.name, inputValues.desc)
      cancel: ->
        logger.debug("User canceled creating plan")
    })
  "click #add-plan": ->
    logger.debug("Button for adding project plan clicked")
  "click .edit-project-plan": ->
    logger.debug("Entering edit mode for project plan '#{@name}' (ID #{@id})")
  "click .remove-project-plan": ->
    notificationService.question("Remove Project Plan?",
      "Are you sure you wish to remove the project plan #{@name}?",
      =>
        logger.debug("Removing project plan '#{@name}' (ID #{@id})")
        Session.set("isWaiting", true)
        invokeTrelloApi("removeTrelloBoard", (error, result) ->
          if error?
            logger.warn("Server failed to remove Trello board", error)
            notificationService.warn("Error",
              "Server failed to remove Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully remove Trello board")
        , @id)
    , ->
      logger.debug("User declined removing project plan")
    )

})

invokeTrelloApi = (methodName, callback, args...) ->
  Session.set("isWaiting", true)
  Trello.setKey(Meteor.settings.public.trelloKey)
  Trello.authorize({
    type: "popup"
    name: "MuzHack"
    scope: { read: true, "write": true }
    success: ->
      logger.info("Trello authorization succeeded")
      token = Trello.token()
      Meteor.call(methodName, token, args..., (error, result) ->
        Session.set("isWaiting", false)
        callback(error, result)
      )
    error: ->
      logger.warn("Trello authorization failed")
      Session.set("isWaiting", false)
  })