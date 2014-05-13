/* 
                   _____  _____  _____                           
    ______  __ ___/ ____\/ ____\/ ____\___________ __ __  _____  
    \____ \|  |  \   __\\   __\\   __\/  _ \_  __ \  |  \/     \ 
    |  |_> >  |  /|  |   |  |   |  | (  <_> )  | \/  |  /  Y Y  \
    |   __/|____/ |__|   |__|   |__|  \____/|__|  |____/|__|_|  /
    |__|                                                      \/ 
  
  
  A Puffball module for managing forum-style puffs. Wraps the core Puffball API in a fluffy layer of syntactic spun sugar.

  Usage example:
  PuffForum.onNewPuffs( function(puffs) { console.log(puffs) } )
  PuffForum.init()

*/

PuffForum = {};

PuffForum.graph = {};
PuffForum.newPuffCallbacks = [];
PuffForum.contentTypes = {}

PuffForum.init = function() {
    //// set up everything. 
    // THINK: maybe you can only call this once?
    // THINK: maybe take a zone arg, but default to config
  
    Puffball.onNewPuffs(PuffForum.receiveNewPuffs);
  
    Puffball.init(CONFIG.zone);
    // establishes the P2P network, pulls in all interesting puffs, caches user information, etc
}

PuffForum.getPuffById = function(id) {
    //// get a particular puff
  
    // TODO: check the graph instead of this
  
    return Puffball.Data.puffs.filter(function(puff) { return id === puff.sig })[0]
}


PuffForum.getParents = function(puff) {
    //// get children from a puff
  
    // THINK: do we really need this? the puff will have links to its parents...
  
    if(typeof puff === 'string') {
        puff = PuffForum.getPuffById(puff);
    }
  
    return puff.payload.parents.map(PuffForum.getPuffById)
}

PuffForum.getChildren = function(puff) {
    //// get children from a puff
  
    // THINK: do we really need this? the puff will have links to its children...

    // Find out how many, but only return the latest CONFIG.maxChildrenToShow
  
    if(typeof puff === 'string') {
        puff = PuffForum.getPuffById(puff);
    }

    return Puffball.Data.puffs.filter(function(kidpuff) { return ~kidpuff.payload.parents.indexOf(puff.sig) })
}


PuffForum.getRootPuffs = function(limit) {
    //// returns the most recent parentless puffs, sorted by time

    // limit defaults to 0, which returns all root puffs
  
    // we should probably index these rather than doing a full graph traversal
  
    // TODO: add limit

    return Puffball.Data.puffs.filter(function(puff) { return puff ? !puff.payload.parents.length : 0 })
} 


PuffForum.addPost = function(content, parents, type, metadata, recursive) {
    //// Given a string of content, create a puff and push it into the system
  
    // ensure parents is an array
    if(!parents) parents = []
    if(!Array.isArray(parents)) parents = [parents]
    
    // ensure parents contains only puff ids
    if(parents.map(PuffForum.getPuffById).filter(function(x) { return x != null }).length != parents.length)
        return "Error Error Error: those are not good parents"
 
    // if there's no current user, add an anonymous one
    var user = PuffUsers.getCurrentUser()
    
    if(!user.username) {
        if(recursive)
            return Puffball.onError("Could not create anonymous user. Try sending your puff again with a valid user, or establish a network connection to create a new one.")
        
        // THINK: instead of giving up we could just save it locally until the network is reestablished...
        var pprom = PuffUsers.addAnonUser();
        
        pprom.then(function(username) {
            PuffUsers.setCurrentUser(username)
            PuffForum.addPost(content, parents, type, metadata, true)
        })
    }
    
    var privateKey = user.keys.default.private
    
    // THINK: we definitely want to ensure this is a valid u/p combo... so we'll need to hit the network here.
    if(!Puffball.checkUserKey(user.username, privateKey))  // THINK: by the time we arrive here u/pk should already be cached,
       return false                                    //        so this never requires a network hit... right? 

    // TODO: check the DHT for this user's previous puff's sig
    var previous = 123123123

    // set up the forum puff style payload
    var payload = metadata || {}
    payload.parents = parents                             // ids of the parent puffs
    payload.time = Date.now()                             // time is always a unix timestamp
    payload.tags = payload.tags || []                     // an array of tags // TODO: make these work

    var type  = type || 'text'
    var zones = CONFIG.zone ? [CONFIG.zone] : []

    var puff = Puffball.createPuff(user.username, privateKey, zones, type, content, payload, previous)

    Puffball.addPuff(puff, privateKey)
    
    // THINK: actually we can't return this because we might go async to check the u/pk against the dht
    // return sig;
    
    // NOTE: any puff that has 'time' and 'parents' fields fulfills the forum interface
    // TODO: make an official interface fulfillment thing
}

PuffForum.getDefaultPuff = function() {
    var defaultPuff = CONFIG.defaultPuff
                    ? PuffForum.getPuffById(CONFIG.defaultPuff)
                    : Puffball.Data.puffs[0]
 
    // TODO: use 'locate puff' once it's available, and change this to 'show default puff'
    
    return defaultPuff
}

PuffForum.onNewPuffs = function(callback) {
    //// callback takes an array of puffs as its argument, and is called each time puffs are added to the system
  
    PuffForum.newPuffCallbacks.push(callback)
}

PuffForum.receiveNewPuffs = function(puffs) {
    //// called by core Puff library any time puffs are added to the system
  
    PuffForum.addToGraph(puffs)
    PuffForum.newPuffCallbacks.forEach(function(callback) {callback(puffs)})
}

PuffForum.addToGraph = function(puffs) {
    //// add a set of puffs to our internal graph
  
    puffs.forEach(function(puff) {
    
        // if puff.username isn't in the graph, add it
        // add parent references to puff
        // add child references to puff
        // add puff to graph
        // add parent & child & user edges to graph
    })
}


PuffForum.addContentType = function(name, type) {
    if(!name) return Puffball.onError('Invalid content type name')
    if(!type.toHtml) return Puffball.onError('Invalid content type: object is missing toHtml method')
    
    // TODO: add more thorough name/type checks
    PuffForum.contentTypes[name] = type
}

PuffForum.processContent = function(type, content) {
    var typeObj = PuffForum.contentTypes[type]
    if(!typeObj)
        typeObj = PuffForum.contentTypes['text']

    return typeObj.toHtml(content)
}

PuffForum.getProcessedPuffContent = function(puff) {
    // THINK: we've already ensured these are proper puffs, so we don't have to check for payload... right?
    return PuffForum.processContent(puff.payload.type, puff.payload.content)
}

// DEFAULT CONTENT TYPES

PuffForum.addContentType('text', {
    toHtml: function(content) {
        var safe_content = XBBCODE.process({ text: content })   // not ideal, but it does seem to strip out raw html
        return '<p>' + safe_content.html + '</p>'               // THINK: is this really safe?
    }
})

PuffForum.addContentType('bbcode', {
    toHtml: function(content) {
        var bbcodeParse = XBBCODE.process({ text: content });
        var parsedText  = bbcodeParse.html.replace(/\n/g, '<br />'); 
        return parsedText;
    }
})

PuffForum.addContentType('image', {
    toHtml: function(content) {
        return '<a href=' + content + ' target=new><img src=' + content + ' /></a>'
    }
})

