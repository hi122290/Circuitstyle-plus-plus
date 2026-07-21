/**
 * Global configuration for world, assets, and audio.
 * Centralizing these values allows for easier runtime modifications and modularity.
 */
export const Global = {
    world: {
        skybox: {
            faces: {
                px: 'SkyImg6.png',
                nx: 'SkyImg2.png',
                py: 'SkyImg4.png',
                ny: 'SkyImg1.png',
                pz: 'SkyImg3.png',
                nz: 'SkyImg5.png'
            },
            bottomRotation: Math.PI / 2, // 90 degrees
            tint: 0.98,
            anisotropy: 1
        },
        ground: {
            texture: './Studs_Texture.png',
            repeat: { x: 96, y: 96 },
            roughness: 0.35,
            metalness: 0.05,
            envMapIntensity: 0.5,
            dimensions: {
                width: 320,
                depth: 320,
                thickness: 1
            }
        },
        spawn: {
            texture: './spawn.png',
            topRoughness: 0.08,
            topMetalness: 0.25,
            sideColor: 0x808080,
            dimensions: { width: 2, height: 0.2, depth: 2 }
        }
    },
    audio: {
        paths: {
            bg: './The Great Strategy (2005) Roblox Theme 2006.mp3',
            click: './roblox-button-made-with-Voicemod.mp3',
            walk: './walk.mp3',
            spawn: './roblox-spawn.mp3',
            jump: './roblox-classic-jump.mp3',
            roblox_click: './roblox-click-sound-(made-by-oliverleader08)-made-with-Voicemod.mp3',
            oof: './bannythecoolio-retro-hit-sound-425135.mp3'
        },
        bgVolume: 0.28
    },
    assets: {
        decal: './Roblox Decal.png',
        head: './head.glb',
        face: './face.png',
        studs: './Studs_Texture.png',
        studsBottom: './Studs_Bottom_Texture.png',
        glueStuds: './Glue_Studs_texture.png'
    },
    render: {
        targetDt: 1000 / 26,
        fixedStep: 1000 / 60,
        cameraRenderSkip: 1.2
    }
};

export default Global;
