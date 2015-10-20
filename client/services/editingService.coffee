logger = new Logger("EditingService")

class @EditingService
  @onChange: () ->
    if Session.get("ignoreChanges")
      logger.debug("Ignoring change")
      return

    logger.debug("Project has changed - setting dirty state")
    Session.set("isProjectModified", true)

    if Session.get("isEditingProject")
      data = Router.current().data()
      projectId = "#{data.owner}/#{data.projectId}"
      entryName = "projectEditing"
    else
      entryName = "projectCreating"
      projectId = document.getElementById("id-input").value
    setTimeout(->
      title = trimWhitespace(document.getElementById("title-input").value)
      description = markdownService.getDescription()
      instructions = markdownService.getInstructions()
      tags = R.map(trimWhitespace, S.wordsDelim(/,/, document.getElementById("tags-input").value))
      licenseSelect = document.getElementById("license-select")
      licenseId = licenseSelect.options[licenseSelect.selectedIndex].value
      logger.debug("Saving editing data to localStorage")
      localStorage.setItem(entryName, JSON.stringify({
        id: projectId
        title: title
        description: description
        instructions: instructions
        tags: tags
        licenseId: licenseId
      }))
    , 0)
