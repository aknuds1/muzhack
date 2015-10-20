logger = new Logger("EditingService")

class @EditingService
  @onChange: () ->
    if Session.get("ignoreChanges")
      logger.debug("Ignoring change")
      return

    logger.debug("Project has changed - setting dirty state")
    Session.set("isProjectModified", true)

    data = Router.current().data()
    projectId = "#{data.owner}/#{data.projectId}"
    setTimeout(->
      title = trimWhitespace($("#title-input").val())
      description = markdownService.getDescription()
      instructions = markdownService.getInstructions()
      tags = R.map(trimWhitespace, S.wordsDelim(/,/, $("#tags-input").val()))
      licenseSelect = document.getElementById("license-select")
      licenseId = licenseSelect.options[licenseSelect.selectedIndex].value
      logger.debug("Saving editing data to localstorage, project ID: '#{projectId}'")
      logger.debug("Editing data:", licenseId)
      localStorage.setItem("projectEditing", JSON.stringify({
        id: projectId
        title: title
        description: description
        instructions: instructions
        tags: tags
        licenseId: licenseId
      }))
    , 0)
