//
var _generator = 0;
var _count = 0;

var Particle = function(name) {
	this.name = name;
	this.id = _generator++;
	this.coords = [];
	
	this._counter = 0;
	
	_count++;
	
	Particle.prototype.getThisCoordTime = function() {
		return this.coords[this._counter];
	}
	
	Particle.prototype.getNextCoordTime = function() {
		return this.coords[this._counter++];
	}
}

Particle.reset = function(particles) {
	if(typeof particles === 'undefined')
		return
	
	for(var p in particles)
		particles[p]._counter = 0;
}

Particle.remove = function() {
	_generator = 0;
	_count = 0;
}

Particle.count = function() {
	return _count;
}

//
var CoordinateTime = function(lonLat, time) {
	this.lon = lonLat[0];
	this.lat = lonLat[1];
	this.time = time;
}

//
var Updater = function() {
	this.updateCounter = 0;
	this.updateCounterMax;
	
	this.updateTimes = [];
	this.updates = {}
	
	Updater.prototype.add = function(name, time) {
		if(typeof this.updates[time] === 'undefined'){
			this.updateTimes.push(time);
			this.updates[time] = [];
		}
		this.updates[time].push(name);
	}
	
	Updater.prototype.prepare = function() {
		this.updateCounterMax = this.updateTimes.length;
		this.updateTimes.sort(sortNumber);
	}
	
	Updater.prototype.reset = function() {
		this.updateCounter = 0;
		return this.updates[this.updateTimes[this.updateCounter]];
	}
	
	Updater.prototype.get = function(time) {
		var result = [];
		while(time >= this.updateTimes[this.updateCounter]){
			result.push.apply(result, this.updates[this.updateTimes[this.updateCounter++]]);
		}
		if(result.length > 0)
			return result;
		else if(this.updateCounter >= this.updateCounterMax)
			return undefined;
		else
			return [];
	}
}

var sortNumber = function(a,b) {
    return a - b;
}