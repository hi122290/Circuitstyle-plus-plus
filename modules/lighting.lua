-- lighting.lua (Strict Lua 5.1 - 2007 High-Intensity Edition)
lighting = {
    -- The "Washout": High ambient intensity makes everything bright and flat
    ambient = { r = 1.0, g = 1.0, b = 1.0, intensity = 2.0 }, 
    
    -- The "Shiny Bulb": Increased intensity to mimic the massive 2007 sun glare
    directional = { 
        r = 1.0, g = 1.0, b = 1.0, 
        intensity = 1.8, -- Making the 'bulb' feel bigger/brighter
        position = { x = 100, y = 200, z = 100 } 
    },
    
    shadows = true,
    tone_mapping = "None",
    exposure = 1.2, -- Over-exposing slightly to get that "shiny" look
    output_srgb = false, 
    texture_filter = "Nearest",

    hlsl = [[
    matrix World;
    matrix View;
    matrix Projection;
    
    float4 LightColor = float4(1.0, 1.0, 1.0, 1.0);
    float4 AmbientColor = float4(0.9, 0.9, 0.9, 1.0); // Bolder ambient for less "dimness"
    float3 LightDir = normalize(float3(0.5, -1.0, 0.5));

    struct VS_INPUT {
        float3 Position : POSITION;
        float3 Normal   : NORMAL;
        float2 TexCoord : TEXCOORD0;
    };

    struct VS_OUTPUT {
        float4 Pos      : SV_POSITION;
        float4 WorldPos : TEXCOORD1; 
        float2 UV       : TEXCOORD2;
    };

    VS_OUTPUT VS_Main(VS_INPUT IN) {
        VS_OUTPUT OUT;
        OUT.WorldPos = mul(float4(IN.Position, 1.0), World);
        OUT.UV = IN.TexCoord;
        OUT.Pos = mul(OUT.WorldPos, mul(View, Projection));
        return OUT;
    }

    sampler2D DiffuseMap : register(s0);
    float4 DiffuseColor = float4(1.0, 1.0, 1.0, 1.0);

    float4 PS_Main(VS_OUTPUT IN) : SV_Target {
        // FLAT SHADING CALCULATION (Zero Gradients)
        float3 fdx = ddx(IN.WorldPos.xyz);
        float3 fdy = ddy(IN.WorldPos.xyz);
        float3 N = normalize(cross(fdx, fdy));
        float3 L = normalize(-LightDir);
        
        // 2007 logic: Hard light transition
        float NdotL = step(0.01, dot(N, L)); 
        
        float4 tex = tex2D(DiffuseMap, IN.UV);
        float3 base = tex.rgb * DiffuseColor.rgb;

        // Combine light with a very high ambient floor
        // This removes the "dim" feeling by making the minimum brightness very high
        float3 diffuse = NdotL * LightColor.rgb;
        float3 finalColor = base * (diffuse + AmbientColor.rgb);
        
        return float4(finalColor, tex.a * DiffuseColor.a);
    }

    technique10 Legacy2007 {
        pass P0 {
            SetVertexShader( CompileShader( vs_4_0, VS_Main() ) );
            SetPixelShader( CompileShader( ps_4_0, PS_Main() ) );
        }
    };
    ]]
}