//Variables and functions starting with "_" are intended for internal use.

//********** Particle **********
var _generator = 0;
var _count = 0;

var Particle = function(name) {
	this.name = name;
	this.id = _generator++;
	this.coords = [];
	this.visible = false;
	
	this._counter = 0;
	
	_count++;
	
	Particle.prototype.getThisCoordTime = function() {
		return this.coords[this._counter];
	}
	
	Particle.prototype.getNextCoordTime = function() {
		return this.coords[this._counter++];
	}
	
	Particle.prototype.setTime = function(time) {
		if(this.coords[0].time > time){
			this.visible = false;
			return;
		}
		
		this._counter = 0;
		
		//binary search
		var startIndex = 0;
        var stopIndex = this.coords.length - 1;
        var middle = Math.floor((stopIndex + startIndex)/2);

		while(this.coords[middle].time != time && startIndex < stopIndex){
			if (time < this.coords[middle].time)
				stopIndex = middle - 1;
			else if (time > this.coords[middle].time)
				startIndex = middle + 1;

			middle = Math.floor((stopIndex + startIndex)/2);
		}

		if(this.coords[middle].time <= time || typeof this.coords[middle+1] === 'undefined')
			this._counter = middle;
		else
			this._counter = ++middle;
		
		this.visible = true;
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

//********** Coordinate - time **********
var CoordinateTime = function(lonLat, time) {
	this.lon = lonLat[0];
	this.lat = lonLat[1];
	this.time = time;
}

//********** Updater **********
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
		this.updateTimes.sort(_sortNumber);
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
	
	Updater.prototype.set = function(factor) {
		var targetTime = this.minTime() + factor*(this.maxTime()-this.minTime());
		
		//binary search
		var startIndex = 0;
        var stopIndex = this.updateCounterMax-1;
        var middle = Math.floor((stopIndex + startIndex)/2);

		while(this.updateTimes[middle] != targetTime && startIndex < stopIndex){
			if (targetTime < this.updateTimes[middle])
				stopIndex = middle - 1;
			else if (targetTime > this.updateTimes[middle])
				startIndex = middle + 1;

			middle = Math.floor((stopIndex + startIndex)/2);
		}
		if(this.updateTimes[middle] <= targetTime || typeof this.updateTimes[middle+1] === 'undefined')
			this.updateCounter = middle;
		else
			this.updateCounter = ++middle;
		return targetTime;
	}
	
	Updater.prototype.minTime = function() {
		return this.updateTimes[0];
	}
	
	Updater.prototype.maxTime = function() {
		return this.updateTimes[this.updateCounterMax-1];
	}
}

var _sortNumber = function(a,b) {
    return a - b;
}