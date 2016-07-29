
precision highp float;
precision mediump int;

varying float alphaVar;
varying float heatmapVar;
varying float modeVar;

uniform sampler2D texture;
varying vec3 unpackedColor;

void main() {
	if(heatmapVar == 0.0) {
		vec2 remap = (gl_PointCoord - 0.5) * 2.0;
		float dist = pow(remap.x, 2.0) + pow(remap.y, 2.0);
		if(dist < 1.0 && (modeVar == 1.0 ? dist > 0.3 : true))
			gl_FragColor = vec4(unpackedColor, alphaVar);
	}
	else
		gl_FragColor = vec4(0.9, 0.2, 0.0, alphaVar) * texture2D( texture, gl_PointCoord );
}
