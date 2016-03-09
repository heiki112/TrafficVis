//********** ParticleManager **********
var ParticleManager = function(data) {
	var self = this;
	this.ready = false;
	this.maxTime = 0;
	this.maxChunkSize = 0;
	this.data = data;
	
	//position-time data chunks, lists of Float32Array
	this.startChunks = [];
	this.endChunks = [];
	
	
	ParticleManager.prototype.createChunks = function() {
		firstPass(0);
	}
	
	var firstPass = function(particleId) {
		var idLimit = particleId + 10000;
		if(idLimit > self.data.particles.length)
			idLimit = self.data.particles.length;
		
		for(var i = particleId; i < idLimit; i++) {
			var particle = self.data.particles[i];
			for(var j = 0; j < particle.coordTimes.length; j++){
				var lonLat = transf([particle.coordTimes[j].lat, particle.coordTimes[j].lon]);
				particle.coordTimes[j].lon = lonLat[0];
				particle.coordTimes[j].lat = lonLat[1];
				if(particle.coordTimes[j].time > self.maxTime)
					self.maxTime = particle.coordTimes[j].time;
			}
			//self.particleList[i].sortCoords();
		}
		setTimeout(function() {
			if(idLimit < self.data.particles.length)
				firstPass(idLimit);
			else
				createChunksInner(0);
		}, 0)
	}
	
	var createChunksInner = function(chunkCounter) {
		if(chunkCounter*ParticleManager.prototype.chunkTime > self.maxTime) {
			self.ready = true;
			return;
		}
		
		var chunkStartArray = [];
		var chunkEndArray = [];
		for(var i = 0; i < self.data.particles.length; i++) {
			var particle = self.data.particles[i];
			var slot = self.searchTimeSlot(i, chunkCounter*ParticleManager.prototype.chunkTime);
			//var slot = particle.searchTimeSlot(chunkCounter*ParticleManager.prototype.chunkTime);
			if(typeof(slot) != 'undefined') {
				while(slot < particle.coordTimes.length-1 && particle.coordTimes[slot].time < (chunkCounter+1)*ParticleManager.prototype.chunkTime) {
					
					chunkStartArray.push(particle.coordTimes[slot].lon);
					chunkStartArray.push(particle.coordTimes[slot].lat);
					chunkStartArray.push(particle.coordTimes[slot].time);
					
					chunkEndArray.push(particle.coordTimes[slot+1].lon);
					chunkEndArray.push(particle.coordTimes[slot+1].lat);
					chunkEndArray.push(particle.coordTimes[slot+1].time);
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
	
	ParticleManager.prototype.sortCoords = function(id) {
		self.data.particles[id].coordTimes.sort( function(ct1, ct2) { return ct1.time - ct2.time } );
	}
	
	ParticleManager.prototype.searchTimeSlot = function(id, time) {
		if(typeof(self.data.particles[id].coordTimes[0]) == 'undefined' || self.data.particles[id].coordTimes[0].time > time){
			return undefined;
		}
		
		//binary search
		var low = 0;
        var high = self.data.particles[id].coordTimes.length - 1;
		var middle = Math.floor((high + low)/2);

		while(low < high){
			if(time < self.data.particles[id].coordTimes[middle].time)
				high = middle;
			else
				low = middle+1;
			
			middle = Math.floor((high + low)/2);
		}
		
		if(self.data.particles[id].coordTimes[middle].time > time)
			middle--;
		
		return middle;
	}
	
}

ParticleManager.prototype.chunkTime = 10000;	//default chunk time size, in milliseconds

ParticleManager.getChunkTime = function() {
	return ParticleManager.prototype.chunkTime;
}