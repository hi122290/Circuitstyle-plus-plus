-- modules/stencil_shadows.lua
-- Strict Lua 5.1 implementation of a stencil shadow-volume helper.
-- This file does not depend on a specific rendering API; it provides
-- pure data manipulation and a small API to produce shadow-volume meshes
-- (lists of triangles) and stencil-pass draw callbacks suitable for a
-- renderer that supports stencil buffer operations.
--
-- Usage (conceptual):
--   local ss = require('modules.stencil_shadows') -- if using require
--   local volume = ss.build_shadow_volume(mesh, light_pos, infinity_dist)
--   -- feed 'volume' triangles into your renderer's stencil pass:
--   --   1. Render front faces incrementing stencil on depth fail / decrement on depth pass, etc.
--   --   2. Render back faces with opposite operations.
--   --   3. Render scene with stencil test to only shade pixels outside shadow volume.
--
-- The code is careful to use plain Lua 5.1 constructs (no metatables magic, no bitops).
-- It returns a module table 'M' with pure functions and small helpers.

local M = {}

-- Very small vector helpers (tables used as {x=...,y=...,z=...})
local function vec_new(x,y,z) return { x = x or 0, y = y or 0, z = z or 0 } end
local function vec_sub(a,b) return { x = a.x - b.x, y = a.y - b.y, z = a.z - b.z } end
local function vec_add(a,b) return { x = a.x + b.x, y = a.y + b.y, z = a.z + b.z } end
local function vec_mul(a, s) return { x = a.x * s, y = a.y * s, z = a.z * s } end
local function vec_dot(a,b) return a.x*b.x + a.y*b.y + a.z*b.z end
local function vec_cross(a,b)
    return {
        x = a.y*b.z - a.z*b.y,
        y = a.z*b.x - a.x*b.z,
        z = a.x*b.y - a.y*b.x
    }
end
local function vec_normalize(a)
    local l = math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z)
    if l == 0 then return {x=0,y=0,z=0} end
    return { x = a.x / l, y = a.y / l, z = a.z / l }
end

-- Build adjacency: given mesh as { vertices = { {x,y,z}, ... }, faces = { {i1,i2,i3}, ... } }
-- returns edge -> {faceIndices...} map where edge key is "minIdx_maxIdx"
function M.build_edge_map(mesh)
    local edges = {}
    local faces = mesh.faces or {}
    for fi=1,#faces do
        local f = faces[fi]
        local idx = { f[1], f[2], f[3] }
        for e=1,3 do
            local a = idx[e]
            local b = idx[(e%3)+1]
            local key
            if a < b then key = a .. '_' .. b else key = b .. '_' .. a end
            if not edges[key] then edges[key] = { a = a, b = b, faces = {} } end
            table.insert(edges[key].faces, fi)
        end
    end
    return edges
end

-- Compute per-face normals (non-normalized) for culling tests
function M.compute_face_normals(mesh)
    local verts = mesh.vertices or {}
    local normals = {}
    for fi=1, # (mesh.faces or {}) do
        local f = mesh.faces[fi]
        local v1 = verts[f[1]]; local v2 = verts[f[2]]; local v3 = verts[f[3]]
        local e1 = vec_sub(v2, v1)
        local e2 = vec_sub(v3, v1)
        local n = vec_cross(e1, e2)
        normals[fi] = n
    end
    return normals
end

-- Determine which faces are front-facing to a given light position (point or directional)
-- light: { x,y,z, w }  (w==0 -> directional (direction = normalized x,y,z), w==1 -> point light)
function M.cull_faces_against_light(mesh, light, faceNormals)
    local verts = mesh.vertices or {}
    local faces = mesh.faces or {}
    local front = {}
    for fi=1,#faces do
        local f = faces[fi]
        local v = verts[f[1]]
        local ln
        if light.w == 0 then
            -- directional light, direction vector points FROM light (so use -dir to light vector)
            ln = { x = -light.x, y = -light.y, z = -light.z }
        else
            ln = vec_sub(light, v)
        end
        -- face normal (not normalized) and light vector
        local n = faceNormals[fi] or { x=0,y=0,z=0 }
        local dp = vec_dot(n, ln)
        front[fi] = (dp >= 0) -- treat zero as front-facing to avoid losing coplanar silhouette edges
    end
    return front
end

-- Build silhouette edges (edges shared between a front-facing and back-facing face are silhouette)
-- returns list of edges { a=idx, b=idx } in mesh vertex index space
function M.build_silhouette(mesh, light)
    local edges = M.build_edge_map(mesh)
    local faceNormals = M.compute_face_normals(mesh)
    local faceFront = M.cull_faces_against_light(mesh, light, faceNormals)

    local silhouette = {}
    for key, e in pairs(edges) do
        local fcount = #e.faces
        if fcount == 1 then
            -- boundary edge always silhouette
            table.insert(silhouette, { a = e.a, b = e.b })
        else
            -- shared edge: check if one face is front and the other is back
            local f1 = e.faces[1]; local f2 = e.faces[2]
            local f1front = faceFront[f1]
            local f2front = faceFront[f2]
            if f1front ~= f2front then
                table.insert(silhouette, { a = e.a, b = e.b })
            end
        end
    end

    return silhouette
end

-- Extrude a vertex away from the light to "infinity" (finite far distance used)
local function extrude_vertex(v, light, dist)
    if light.w == 0 then
        -- directional: move along direction (light vector normalized)
        local dir = vec_normalize({ x = light.x, y = light.y, z = light.z })
        -- for directional lights, extrude in opposite of light direction
        return vec_add(v, vec_mul(dir, dist))
    else
        -- point light: direction from light to vertex, push away
        local d = vec_sub(v, light)
        local nd = vec_normalize(d)
        return vec_add(v, vec_mul(nd, dist))
    end
end

-- Build shadow volume geometry (triangle list) for given mesh and light
-- mesh: { vertices = {...}, faces = {...} }
-- light: { x,y,z,w } (w 0 directional, 1 point)
-- infinity_dist: numeric distance to extrude (must be finite)
-- Returns: volume = { vertices = { ... }, triangles = { {i1,i2,i3}, ... } }
function M.build_shadow_volume(mesh, light, infinity_dist)
    infinity_dist = infinity_dist or 1000.0
    local verts = mesh.vertices or {}
    local faces = mesh.faces or {}

    -- silhouette edges in index space
    local silhouette = M.build_silhouette(mesh, light)

    -- We'll construct a volume by extruding each silhouette edge to create quads (two triangles each)
    local volumeVerts = {}
    local volumeTris = {}

    -- Helper to push vertex and get index (1-based)
    local function pushv(v)
        table.insert(volumeVerts, { x = v.x, y = v.y, z = v.z })
        return #volumeVerts
    end

    -- For each silhouette edge (a,b): create quad [a, b, b_extruded, a_extruded]
    for i=1,#silhouette do
        local e = silhouette[i]
        local va = verts[e.a]; local vb = verts[e.b]
        local vae = extrude_vertex(va, light, infinity_dist)
        local vbe = extrude_vertex(vb, light, infinity_dist)

        local ia = pushv(va)
        local ib = pushv(vb)
        local ibe = pushv(vbe)
        local iae = pushv(vae)

        -- Two triangles (ia, ib, ibe) and (ibe, iae, ia)
        table.insert(volumeTris, { ia, ib, ibe })
        table.insert(volumeTris, { ibe, iae, ia })
    end

    -- Optionally, cap near and far ends for closed volume:
    -- Near-cap = original front-facing faces (optional)
    -- Far-cap = extruded copies of back-facing faces (optional)
    -- NOTE: many stencil schemes avoid caps to rely on z-fail approach; leave caps empty so caller chooses.
    -- Provide helper lists of near/far cap triangles for renderers that want them.
    local nearCap = {}
    local farCap = {}
    local faceNormals = M.compute_face_normals(mesh)
    local faceFront = M.cull_faces_against_light(mesh, light, faceNormals)
    -- Build near cap using original face indices for faces that are back-facing (for z-fail they are used differently),
    -- but here we simply return lists so renderer may use either z-pass or z-fail technique.
    for fi=1,#faces do
        if faceFront[fi] then
            -- near cap: use original face (aswards facing)
            local f = faces[fi]
            table.insert(nearCap, { f[1], f[2], f[3] })
            -- far cap: extruded triangle (mapped to new extruded vertices)
            -- compute extruded indices by pushing extruded vertices
            local ea = extrude_vertex(verts[f[1]], light, infinity_dist)
            local eb = extrude_vertex(verts[f[2]], light, infinity_dist)
            local ec = extrude_vertex(verts[f[3]], light, infinity_dist)
            local ia = pushv(ea)
            local ib = pushv(eb)
            local ic = pushv(ec)
            table.insert(farCap, { ia, ib, ic })
        end
    end

    return {
        vertices = volumeVerts,
        triangles = volumeTris,
        nearCap = nearCap,
        farCap = farCap,
    }
end

-- Helper to convert a triangle list into a draw callback description for a renderer with stencil ops.
-- This returns a table of "passes" with description that a host renderer should interpret:
--   { { mode = 'stencil_incr_on_depth_fail', triangles = {...} }, { mode = 'stencil_decr_on_depth_fail', triangles = {...} } }
-- Note: actual stencil op constants are renderer-specific; this helper provides semantic passes.
function M.stencil_pass_plan_from_volume(volume)
    -- We follow a standard z-fail (Carmack's reverse) friendly pattern description:
    -- 1) Render front faces (of volume) with front-face winding and increment stencil on depth fail
    -- 2) Render back faces with back-face winding and decrement stencil on depth fail
    --
    -- Host renderer must set:
    --   - depthTest = true
    --   - depthMask = false (do not write depth while building stencil)
    --   - colorMask = false (do not write color)
    --   - appropriate culling (front/back)
    --   - stencil func/ops as described by mode strings below.
    local frontTris = {}
    local backTris = {}
    for i=1,#(volume.triangles or {}) do
        local t = volume.triangles[i]
        -- By construction the quads were produced using a winding consistent with outward-facing side;
        -- keep the triangle as front face for the front-pass and reversed for the back-pass.
        table.insert(frontTris, t)
        table.insert(backTris, { t[3], t[2], t[1] }) -- reversed winding
    end

    return {
        {
            mode = 'stencil_incr_on_depth_fail_front_faces',
            triangles = frontTris
        },
        {
            mode = 'stencil_decr_on_depth_fail_back_faces',
            triangles = backTris
        }
    }
end

-- Small utility to transform mesh vertex-list from numeric arrays into x,y,z keyed tables,
-- if input is arrays like { {x,y,z}, ... } convert to { {x=...,y=...,z=...}, ... }
function M.normalize_vertices(mesh)
    local verts = mesh.vertices or {}
    local out = {}
    for i=1,#verts do
        local v = verts[i]
        if type(v) == 'table' and v.x and v.y and v.z then
            out[i] = { x = v.x, y = v.y, z = v.z }
        else
            -- positional array
            out[i] = { x = v[1] or 0, y = v[2] or 0, z = v[3] or 0 }
        end
    end
    mesh.vertices = out
    return mesh
end

-- Simple example helper: create a point-light table
function M.point_light(x,y,z)
    return { x = x or 0, y = y or 0, z = z or 0, w = 1 }
end

-- Simple helper: create directional light table (direction vector points FROM light)
function M.directional_light(dx,dy,dz)
    local d = vec_normalize({ x = dx or 0, y = dy or 0, z = dz or 1 })
    return { x = d.x, y = d.y, z = d.z, w = 0 }
end

-- Small diagnostics: count triangles in a volume
function M.volume_triangle_count(vol)
    local t = vol and vol.triangles and #vol.triangles or 0
    local n = vol and vol.nearCap and #vol.nearCap or 0
    local f = vol and vol.farCap and #vol.farCap or 0
    return t + n + f
end

-- Export module
return M

