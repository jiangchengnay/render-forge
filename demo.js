window.RF_DEMO = {
  "meta": {
    "title": "Render Forge Flagship",
    "width": 1080,
    "height": 1080,
    "duration": 16,
    "seed": 20261010
  },
  "palette": "deepSea",
  "post": [
    {
      "effect": "bloom",
      "amount": 0.45,
      "threshold": 0.68,
      "radius": 20
    },
    {
      "effect": "vignette",
      "amount": 0.6
    },
    {
      "effect": "grain",
      "amount": 0.05,
      "cell": 2
    }
  ],
  "acts": [
    {
      "id": "open",
      "dur": 4,
      "background": {
        "type": "radial",
        "cx": 0.5,
        "cy": 0.5,
        "radius": 1.15,
        "inner": "#0a1838",
        "outer": "#020610"
      },
      "transitionIn": {
        "type": "fade",
        "dur": 0.5,
        "color": "#000"
      },
      "transitionOut": {
        "type": "wipe",
        "dur": 0.35,
        "dir": "left",
        "color": "#020610"
      },
      "camera": {
        "zoomFrom": 1.15,
        "zoomTo": 1,
        "ease": "outCubic"
      },
      "tracks": [
        {
          "effect": "gradientBlob",
          "at": 0,
          "dur": 4,
          "opacity": 0.35,
          "params": {
            "count": 2,
            "alpha": 0.35,
            "mode": "screen"
          }
        },
        {
          "effect": "dotGrid",
          "at": 0,
          "dur": 4,
          "opacity": 0.55,
          "params": {
            "spacing": 0.045,
            "dotR": 0.0018,
            "color": "rgba(90,180,255,0.35)",
            "reveal": "radial"
          }
        },
        {
          "effect": "ripples",
          "at": 0.2,
          "dur": 3.8,
          "opacity": 0.6,
          "blend": "lighter",
          "params": {
            "count": 3,
            "maxRadius": "=0.25 + sin(t * 2.5) * 0.15",
            "lineWidth": 1.5,
            "color": "$accent",
            "alpha": 0.7
          }
        },
        {
          "effect": "morphPolygon",
          "at": 0.5,
          "dur": 3.5,
          "opacity": 0.7,
          "blend": "lighter",
          "params": {
            "sides": 6,
            "radius": "=0.05 + abs(sin(t * 1.5)) * 0.03",
            "rotSpeed": 0.8,
            "fill": "rgba(0,229,255,0.35)",
            "stroke": "$accent",
            "lineWidth": 2.5,
            "breath": 0.15
          }
        },
        {
          "effect": "titleCard",
          "at": 1.2,
          "dur": 2.8,
          "ease": "outCubic",
          "opacity": 1,
          "params": {
            "badge": "PROCEDURAL",
            "title": "Render Forge",
            "subtitle": "表达式 · 分组 · 镜头 · 节拍",
            "x": 0.5,
            "y": 0.62,
            "titleSize": 0.075,
            "titleWeight": 800,
            "stagger": 0.55,
            "subSize": 0.024,
            "badgeSize": 0.014
          }
        }
      ]
    },
    {
      "id": "metrics",
      "dur": 4,
      "background": {
        "type": "gradient",
        "angle": 135,
        "stops": [
          {
            "at": 0,
            "color": "#03080f"
          },
          {
            "at": 1,
            "color": "#0a1830"
          }
        ]
      },
      "transitionIn": {
        "type": "wipe",
        "dur": 0.35,
        "dir": "left",
        "color": "#020610"
      },
      "transitionOut": {
        "type": "iris",
        "dur": 0.4,
        "color": "#020610"
      },
      "tracks": [
        {
          "effect": "gridWarp",
          "at": 0,
          "dur": 4,
          "opacity": 0.15,
          "params": {
            "cols": 24,
            "rows": 24,
            "dot": 0.9,
            "noiseAmp": 0.012,
            "noiseScale": 1,
            "speed": 0.06,
            "color": "$1"
          }
        },
        {
          "effect": "counterNumber",
          "at": 0.3,
          "dur": 2.2,
          "ease": "outExpo",
          "opacity": 1,
          "params": {
            "from": 0,
            "to": 50,
            "x": 0.25,
            "y": 0.3,
            "size": 0.075,
            "weight": 800,
            "color": "$accent"
          }
        },
        {
          "effect": "labelText",
          "at": 0.3,
          "dur": 2.2,
          "ease": "outCubic",
          "opacity": 0.7,
          "params": {
            "text": "EFFECTS",
            "x": 0.25,
            "y": 0.4,
            "size": 0.013,
            "color": "$fg",
            "letterSpacing": 0.1
          }
        },
        {
          "effect": "counterNumber",
          "at": 0.5,
          "dur": 2.2,
          "ease": "outExpo",
          "opacity": 1,
          "params": {
            "from": 0,
            "to": 9,
            "x": 0.5,
            "y": 0.3,
            "size": 0.075,
            "weight": 800,
            "color": "$1"
          }
        },
        {
          "effect": "labelText",
          "at": 0.5,
          "dur": 2.2,
          "ease": "outCubic",
          "opacity": 0.7,
          "params": {
            "text": "TRANSITIONS",
            "x": 0.5,
            "y": 0.4,
            "size": 0.013,
            "color": "$fg",
            "letterSpacing": 0.1
          }
        },
        {
          "effect": "counterNumber",
          "at": 0.7,
          "dur": 2.2,
          "ease": "outExpo",
          "opacity": 1,
          "params": {
            "from": 0,
            "to": 4,
            "x": 0.75,
            "y": 0.3,
            "size": 0.075,
            "weight": 800,
            "color": "$2"
          }
        },
        {
          "effect": "labelText",
          "at": 0.7,
          "dur": 2.2,
          "ease": "outCubic",
          "opacity": 0.7,
          "params": {
            "text": "TEMPLATES",
            "x": 0.75,
            "y": 0.4,
            "size": 0.013,
            "color": "$fg",
            "letterSpacing": 0.1
          }
        },
        {
          "effect": "lineChart",
          "at": 1.4,
          "dur": 2.4,
          "ease": "outCubic",
          "opacity": 1,
          "params": {
            "x": 0.12,
            "y": 0.55,
            "w": 0.76,
            "h": 0.3,
            "color": "$accent",
            "lineWidth": 3,
            "fill": true,
            "grid": true
          }
        },
        {
          "effect": "labelText",
          "at": 2,
          "dur": 1.8,
          "ease": "outCubic",
          "opacity": 0.6,
          "params": {
            "text": "性能曲线 · 稳定输出",
            "x": 0.5,
            "y": 0.9,
            "size": 0.018,
            "color": "$fg"
          }
        }
      ]
    },
    {
      "id": "cli",
      "dur": 4,
      "background": {
        "type": "radial",
        "cx": 0.5,
        "cy": 0.5,
        "radius": 1,
        "inner": "#0a0820",
        "outer": "#020108"
      },
      "transitionIn": {
        "type": "iris",
        "dur": 0.4,
        "color": "#020610"
      },
      "transitionOut": {
        "type": "glitch",
        "dur": 0.35,
        "colors": [
          "#00e5ff",
          "#ffffff"
        ]
      },
      "tracks": [
        {
          "effect": "gradientBlob",
          "at": 0,
          "dur": 4,
          "opacity": 0.25,
          "params": {
            "count": 1,
            "alpha": 0.3,
            "mode": "screen"
          }
        },
        {
          "effect": "terminalWindow",
          "at": 0.2,
          "dur": 3.8,
          "ease": "outCubic",
          "opacity": 1,
          "params": {
            "x": 0.12,
            "y": 0.15,
            "w": 0.76,
            "h": 0.55,
            "title": "render-forge ~ zsh",
            "lines": [
              "$ npm install render-forge",
              "  added 3 packages in 1.2s",
              "$ render-forge build story.json",
              "  ✓ compiled 50 effects",
              "  ✓ rendered 480 frames",
              "  → output.mp4 (12.4 MB)"
            ],
            "fontSize": 0.019,
            "promptColor": "$accent",
            "textColor": "#d8dde8"
          }
        },
        {
          "effect": "tagCloud",
          "at": 2.2,
          "dur": 1.8,
          "ease": "outCubic",
          "opacity": 1,
          "params": {
            "tags": [
              "MIT",
              "Zero-Deps",
              "WebGL-Ready",
              "MCP",
              "Deterministic"
            ],
            "x": 0.5,
            "y": 0.88,
            "size": 0.019,
            "maxWidth": 0.85
          }
        }
      ]
    },
    {
      "id": "outro",
      "dur": 4,
      "background": {
        "type": "radial",
        "cx": 0.5,
        "cy": 0.5,
        "radius": 1.2,
        "inner": "#0a1838",
        "outer": "#020610"
      },
      "transitionIn": {
        "type": "glitch",
        "dur": 0.35,
        "colors": [
          "#00e5ff",
          "#ffffff"
        ]
      },
      "camera": {
        "zoomFrom": 0.95,
        "zoomTo": 1.05,
        "ease": "inOutCubic"
      },
      "tracks": [
        {
          "effect": "gradientBlob",
          "at": 0,
          "dur": 4,
          "opacity": 0.3,
          "params": {
            "count": 2,
            "alpha": 0.35,
            "mode": "screen"
          }
        },
        {
          "effect": "dotGrid",
          "at": 0,
          "dur": 4,
          "opacity": 0.5,
          "params": {
            "spacing": 0.05,
            "dotR": 0.0018,
            "color": "rgba(90,180,255,0.3)",
            "reveal": "radial"
          }
        },
        {
          "effect": "ripples",
          "at": 0.2,
          "dur": 1.5,
          "ease": "outExpo",
          "opacity": 0.7,
          "blend": "lighter",
          "params": {
            "count": 3,
            "maxRadius": 0.75,
            "lineWidth": 2,
            "color": "$accent",
            "alpha": 0.9
          }
        },
        {
          "effect": "titleCard",
          "at": 0.4,
          "dur": 3.2,
          "ease": "outCubic",
          "opacity": 1,
          "params": {
            "badge": "GET STARTED",
            "title": "npm i render-forge",
            "subtitle": "开源 · MIT · 永久免费",
            "tag": "github.com/render-forge",
            "x": 0.5,
            "y": 0.45,
            "titleSize": 0.052,
            "titleWeight": 800,
            "stagger": 0.5,
            "subSize": 0.022,
            "badgeSize": 0.014,
            "tagSize": 0.016
          }
        },
        {
          "effect": "logoMark",
          "at": 2.4,
          "dur": 1,
          "ease": "outBack",
          "opacity": 0.8,
          "params": {
            "style": "cross",
            "size": 0.035,
            "x": 0.5,
            "y": 0.82,
            "color": "$accent"
          }
        }
      ]
    }
  ]
};