//********** ParticleManager **********
var ParticleManager = function(maxT) {
	var self = this;
	var maxTime = maxT;
	this.maxChunkSize = 0;
	this.ready = false;
	this.particleMap = {};
	this.particleList = [];
	
	//position-time data chunks, lists of Float32Array
	this.startChunks = [];
	this.endChunks = [];
	
	ParticleManager.prototype.add = function(name, lonLat, time) {
		if(typeof this.particleMap[name] === 'undefined'){
			this.particleMap[name] = new Particle();
			this.particleList.push(this.particleMap[name]);
		}
		this.particleMap[name].add(new CoordinateTime(lonLat, time));
	}
	
	ParticleManager.prototype.createChunks = function() {
		sort(0);
	}
	
	var sort = function(particleId) {
		var idLimit = particleId + 10000;
		if(idLimit > self.particleList.length)
			idLimit = self.particleList.length;
		
		for(var i = particleId; i < idLimit; i++) {
			self.particleList[i].sortCoords();
		}
		setTimeout(function() {
			if(idLimit < self.particleList.length)
				sort(idLimit);
			else
				createChunksInner(0);
		}, 0)
	}
	
	var createChunksInner = function(chunkCounter) {
		if(chunkCounter*ParticleManager.prototype.chunkTime > maxTime) {
			self.ready = true;
			return;
		}
		
		var chunkStartArray = [];
		var chunkEndArray = [];
		for(var i = 0; i < self.particleList.length; i++) {
			var particle = self.particleList[i];
			var slot = particle.searchTimeSlot(chunkCounter*ParticleManager.prototype.chunkTime);
			if(typeof(slot) != 'undefined') {
				while(slot < particle.coords.length-1 && particle.coords[slot].time < (chunkCounter+1)*ParticleManager.prototype.chunkTime) {
					
					chunkStartArray.push(particle.coords[slot].lon);
					chunkStartArray.push(particle.coords[slot].lat);
					chunkStartArray.push(particle.coords[slot].time);
					
					chunkEndArray.push(particle.coords[slot+1].lon);
					chunkEndArray.push(particle.coords[slot+1].lat);
					chunkEndArray.push(particle.coords[slot+1].time);
					slot++;
				}
			}
		}
		var arrSize = chunkStartArray.length;
		if(arrSize*2 > self.maxChunkSize)
			self.maxChunkSize = arrSize*2;
		
		var startChunk = new Float32Array(arrSize);
		var endChunk = new Float32Array(arrSize);
		
		for(var i = 0; i < arrSize; i++) {
			startChunk[i] = chunkStartArray[i];
		}
		for(var i = 0; i < arrSize; i++) {
			endChunk[i] = chunkEndArray[i];
		}
		
		self.startChunks.push(startChunk);
		self.endChunks.push(endChunk);
		
		setTimeout(function() {
			createChunksInner(++chunkCounter);
		}, 0)
	}
	
	ParticleManager.prototype.getStartChunk = function(time) {
		return this.startChunks[Math.floor(time/ParticleManager.prototype.chunkTime)];
	}
	
	ParticleManager.prototype.getEndChunk = function(time) {
		return this.endChunks[Math.floor(time/ParticleManager.prototype.chunkTime)];
	}
}

ParticleManager.prototype.chunkTime = 10000;	//default chunk time size, in milliseconds

ParticleManager.getChunkTime = function() {
	return ParticleManager.prototype.chunkTime;
}

//********** Particle **********
var Particle = function(){
	this.coords = [];
	this.sorted = true;
	
	Particle.prototype.add = function(coordTime) {
		if(this.coords.length > 0 && this.coords[this.coords.length-1].time > coordTime.time)
			this.sorted = false;
		this.coords.push(coordTime);
	}
	
	Particle.prototype.sortCoords = function() {
		if(!this.sorted) {
			this.coords.sort(CoordinateTime.sort);
			this.sorted = true;
		}
	}
	
	Particle.prototype.searchTimeSlot = function(time) {
		if(this.coords[0].time > time){
			return undefined;
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
		
		return middle;
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