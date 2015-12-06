//********** Particle **********
var Particle = function(name) {
	if(typeof Particle.prototype.count === 'undefined')
		Particle.prototype.count = 0;
	
	this.name = name;
	this.id = Particle.prototype.count++;
	this.coords = [];
	this.visible = false;
	
	this.counter = 0;
	
	Particle.prototype.getThisCoordTime = function() {
		return this.coords[this.counter];
	}
	
	Particle.prototype.getNextCoordTime = function() {
		if(++this.counter >= this.coords.length)
			this.counter--;
		
		return this.getThisCoordTime();
	}
	
	Particle.prototype.setTime = function(time) {
		if(this.coords[0].time > time){
			this.visible = false;
			return;
		}
		
		//binary search
		var low = 0;
        var high = this.coords.length - 1;
		var middle = Math.floor((high + low)/2);

		while(low < high){
			if(time < this.coords[middle].time)
				high = middle;
			else
				low = middle+1;
			
			middle = Math.floor((high + low)/2);
		}
		
		if(this.coords[middle].time > time)
			middle--;
		
		this.counter = middle;
		this.visible = true;
	}
	
	Particle.prototype.sortCoords = function() {
		this.coords.sort(CoordinateTime.sort);
	}
	
	Particle.reset = function() {
		Particle.prototype.count = 0;
	}
	
	Particle.getCount = function() {
		return Particle.prototype.count;
	}
}


//********** Coordinate - time **********
var CoordinateTime = function(lonLat, time) {
	this.lon = lonLat[0];
	this.lat = lonLat[1];
	this.time = time;
	
	CoordinateTime.sort = function(ct1, ct2) {
		return ct1.time - ct2.time;
	}
}