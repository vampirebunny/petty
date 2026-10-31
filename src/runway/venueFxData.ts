// Auto-generated from assets/runway/*/fx.json.
import type { RunwayThemeId } from './catalog';

export type VenueFx = {
  particles: string;
  colors: string[];
  extra: string;
  beams: string[];
  led: string;
  flash: string;
  fixtures: { layer: string; x: number[]; y: number };
  uplights?: { layer: string; x: number[]; y: number };
  anchors?: { layer: string; points: number[][] };
};

export const venueFxByTheme: Record<RunwayThemeId, VenueFx> = {
  beach:   {
    "particles": "glints",
    "colors": [
      "#FFFFFF",
      "#FFE08A"
    ],
    "extra": "sunPulse",
    "beams": [
      "#FFAD7A",
      "#FFE08A"
    ],
    "led": "#FFAD7A",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    },
    "anchors": {
      "layer": "2-far",
      "points": [
        [
          880,
          230
        ]
      ]
    }
  },
  garden:   {
    "particles": "petals",
    "colors": [
      "#F7A9C9",
      "#FFFFFF",
      "#FFD45E"
    ],
    "extra": "stringLightTwinkle",
    "beams": [
      "#FFE08A",
      "#F7A9C9"
    ],
    "led": "#FFE08A",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    },
    "anchors": {
      "layer": "1-backdrop",
      "points": [
        [
          40.0,
          190.6
        ],
        [
          80.0,
          200.4
        ],
        [
          120.0,
          207.4
        ],
        [
          160.0,
          211.6
        ],
        [
          200.0,
          213.0
        ],
        [
          240.0,
          211.6
        ],
        [
          280.0,
          207.4
        ],
        [
          320.0,
          200.4
        ],
        [
          360.0,
          190.6
        ],
        [
          440.0,
          190.6
        ],
        [
          480.0,
          200.4
        ],
        [
          520.0,
          207.4
        ],
        [
          560.0,
          211.6
        ],
        [
          600.0,
          213.0
        ],
        [
          640.0,
          211.6
        ],
        [
          680.0,
          207.4
        ],
        [
          720.0,
          200.4
        ],
        [
          760.0,
          190.6
        ],
        [
          840.0,
          190.6
        ],
        [
          880.0,
          200.4
        ],
        [
          920.0,
          207.4
        ],
        [
          960.0,
          211.6
        ],
        [
          1000.0,
          213.0
        ],
        [
          1040.0,
          211.6
        ],
        [
          1080.0,
          207.4
        ],
        [
          1120.0,
          200.4
        ],
        [
          1160.0,
          190.6
        ]
      ]
    }
  },
  hero:   {
    "particles": "sparkle",
    "colors": [
      "#FFFFFF",
      "#7CE0FF",
      "#FFD45E"
    ],
    "extra": "searchlights",
    "beams": [
      "#7CE0FF",
      "#FFD45E"
    ],
    "led": "#7CE0FF",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  pirate:   {
    "particles": "glints",
    "colors": [
      "#FFFFFF"
    ],
    "extra": "shipBob",
    "beams": [
      "#FFD45E",
      "#7FF0D8"
    ],
    "led": "#FFD45E",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  rock:   {
    "particles": "confetti",
    "colors": [
      "#FF5FA2",
      "#5FD0FF",
      "#FFD45E",
      "#FFFFFF"
    ],
    "extra": "strobe",
    "beams": [
      "#FF5FA2",
      "#5FD0FF"
    ],
    "led": "#FF5FA2",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  royal:   {
    "particles": "glitter",
    "colors": [
      "#FFD45E",
      "#FFFFFF",
      "#FFB3D6"
    ],
    "extra": "chandelierTwinkle",
    "beams": [
      "#FFD45E",
      "#FFB3D6"
    ],
    "led": "#FFD45E",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    },
    "anchors": {
      "layer": "2-far",
      "points": [
        [
          300,
          200
        ],
        [
          900,
          200
        ]
      ]
    }
  },
  safari:   {
    "particles": "dust",
    "colors": [
      "#FFE9A8",
      "#FFFFFF"
    ],
    "extra": "sunPulse",
    "beams": [
      "#FFD45E",
      "#FF8A5C"
    ],
    "led": "#FFD45E",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    },
    "anchors": {
      "layer": "2-far",
      "points": [
        [
          700,
          380
        ]
      ]
    }
  },
  sea:   {
    "particles": "bubbles",
    "colors": [
      "#FFFFFF"
    ],
    "extra": "causticShimmer",
    "beams": [
      "#7FF0D8",
      "#FFE08A"
    ],
    "led": "#7FF0D8",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  space:   {
    "particles": "stars",
    "colors": [
      "#FFFFFF",
      "#FFE9A8",
      "#CFEFFF"
    ],
    "extra": "shootingStar",
    "beams": [
      "#F49CC8",
      "#7CE0FF"
    ],
    "led": "#F49CC8",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  spooky:   {
    "particles": "fireflies",
    "colors": [
      "#B3FF8A",
      "#FFAD7A"
    ],
    "extra": "fog",
    "beams": [
      "#FFAD7A",
      "#B3FF8A"
    ],
    "led": "#FFAD7A",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    },
    "anchors": {
      "layer": "2-far",
      "points": [
        [
          880,
          190
        ]
      ]
    }
  },
  west:   {
    "particles": "dust",
    "colors": [
      "#FFE9A8",
      "#FFD3A0"
    ],
    "extra": "heatShimmer",
    "beams": [
      "#FFD45E",
      "#FF8A5C"
    ],
    "led": "#FFD45E",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
  winter:   {
    "particles": "snow",
    "colors": [
      "#FFFFFF"
    ],
    "extra": "auroraDrift",
    "beams": [
      "#B9E8FF",
      "#C9FFD8"
    ],
    "led": "#B9E8FF",
    "flash": "#FFFFFF",
    "fixtures": {
      "layer": "4-truss",
      "x": [
        75,
        225,
        375,
        525,
        675,
        825,
        975,
        1125
      ],
      "y": 112
    },
    "uplights": {
      "layer": "3-near",
      "x": [
        200,
        600,
        1000
      ],
      "y": 594
    }
  },
};
