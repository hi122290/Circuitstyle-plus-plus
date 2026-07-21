import * as THREE from 'three';

/**
 * Mid-2007 ROBLOX Spring Physics Engine
 * Ported to JavaScript for accurate 2007-era damped harmonic oscillation.
 * 
 * In 2007, ROBLOX used a Spring class for many of its "BodyMover" objects 
 * and camera systems, defining movement through stiffness (k) and damping (d).
 */
export class Spring {
    constructor(stiffness = 1.4, damping = 0.22, initialValue = new THREE.Vector3()) {
        // stronger stiffness and slightly higher damping by default for snappier yet stable response
        this.k = stiffness;
        this.d = damping;
        
        // Supports both numbers and THREE.Vector3
        if (typeof initialValue === 'number') {
            this.pos = initialValue;
            this.vel = 0;
            this.target = initialValue;
            this.isVector = false;
        } else {
            this.pos = initialValue.clone();
            this.vel = new THREE.Vector3(0, 0, 0);
            this.target = initialValue.clone();
            this.isVector = true;
        }
    }

    /**
     * Updates the spring state based on the current target.
     * @param {number} dt Delta time in seconds (standardized to approx 1/60s for stability)
     */
    update(dt = 1/60) {
        // High-stiffness stability fix: use internal sub-stepping to prevent integration errors at high speed
        const substeps = 10;
        const subDt = dt / substeps;

        for (let i = 0; i < substeps; i++) {
            if (this.isVector) {
                // Force = k * (target - pos) - d * vel
                const displacement = new THREE.Vector3().subVectors(this.target, this.pos);
                const springForce = displacement.multiplyScalar(this.k);
                const dampingForce = this.vel.clone().multiplyScalar(this.d);
                
                const totalForce = springForce.sub(dampingForce);
                
                // Integrate velocity: v = v + a*subDt (assuming mass = 1)
                this.vel.add(totalForce.multiplyScalar(subDt));
                // Integrate position: p = p + v*subDt
                this.pos.add(this.vel.clone().multiplyScalar(subDt));
            } else {
                const displacement = this.target - this.pos;
                const springForce = displacement * this.k;
                const dampingForce = this.vel * this.d;
                
                const totalForce = springForce - dampingForce;
                
                this.vel += totalForce * subDt;
                this.pos += this.vel * subDt;
            }
        }
        return this.pos;
    }

    /**
     * Resets position and velocity instantly
     */
    snapTo(value) {
        if (this.isVector) {
            this.pos.copy(value);
            this.target.copy(value);
            this.vel.set(0, 0, 0);
        } else {
            this.pos = value;
            this.target = value;
            this.vel = 0;
        }
    }
}