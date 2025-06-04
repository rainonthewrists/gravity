let trajectories = [];
let boxRotation = { x: 0, y: 0 };
const BOX_SIZE = 400;
let speedMultiplier = 1;
const SPEED_SENSITIVITY = 0.01;
const COLLECTOR_LINE_LENGTH = BOX_SIZE;
const CENTER_THRESHOLD = 50;
const MIN_REQUIRED_WORDS = 3;
const TEXT_PADDING = 10;

const phraseTemplates = [
  ["subj_sg", "action_sg", "obj", "desc"],
  ["subj_pl", "action_pl", "obj", "desc"],
  ["subj_sg", "desc", "action_sg"],
  ["subj_pl", "desc", "action_pl"],
  ["obj", "action_sg", "desc"],
  ["place", "subj_sg", "action_sg", "time"],
  ["time", "subj_pl", "action_pl", "place"],
  ["subj_sg", "action_sg", "place", "desc"],
  ["subj_pl", "action_pl", "obj"],
  ["place", "desc", "action_sg"],
  ["subj_sg", "action_sg", "obj"],
  ["desc", "subj_sg", "action_sg"],
  ["place", "obj", "action_sg"],
  ["time", "obj", "action_sg", "desc"],
  ["subj_pl", "desc", "place", "action_pl"]
];

const wordDictionary = {
  subj_sg: [
    "fish", "memory", "current", "silence", "mirror", "voice", "dream", "drop", "fragment", "cloud"
  ],
  subj_pl: [
    "fish", "memories", "currents", "echoes", "voices", "fragments", "dreams", "bubbles", "layers", "ripples"
  ],
  action_sg: [
    "drifts", "vanishes", "glides", "echoes", "hovers", "lingers", "sleeps", "rises", "dives", "shivers"
  ],
  action_pl: [
    "drift", "vanish", "glide", "echo", "hover", "linger", "sleep", "rise", "dive", "shiver"
  ],
  obj: [
    "reflection", "path", "whisper", "trace", "shore", "thread", "pulse", "shadow", "light", "signal"
  ],
  desc: [
    "slowly", "without sound", "like a question", "barely", "in circles", "as if lost", "with weight", "softly", "from below", "through time"
  ],
  place: [
    "beneath the surface", "in the deep", "at the edge", "near the light", "within the current", "under the sky", "on the border", "beyond the reef"
  ],
  time: [
    "at dawn", "before memory", "after the storm", "in a pause", "during the drift", "when silence falls", "at low tide", "in the between"
  ]
};

let currentTemplate = [];
let templatePosition = 0;
let collectedWords = [];
const USED_WORDS = new Set();
let completedPhrases = [];

class Trajectory {
  constructor(type, isCollector = false) {
    this.type = type;
    this.isCollector = isCollector;
    this.points = [];
    this.radius = BOX_SIZE/3;
    this.activeWords = [];
    
    if (type === 'line' && !isCollector) {
      this.initOffsetLine();
    } else {
      this.init();
    }
  }

  initOffsetLine() {
    let dir = p5.Vector.random3D().normalize();
    let start = dir.mult(BOX_SIZE/2);
    let end = start.copy().mult(-1);
    this.points = [start, end];
	}

  init() {
    if (this.isCollector) {
      this.lineStart = createVector(-BOX_SIZE/2, 0, 0);
      this.lineEnd = createVector(BOX_SIZE/2, 0, 0);
      this.points = [this.lineStart, this.lineEnd];
      return;
    }

    switch(this.type) {
      case 'sine':
        const numPoints = 200;
        const zScale = 0.8;
        const frequency = 7;
        for(let t = 0; t < TWO_PI; t += TWO_PI/numPoints) {
          const x = this.radius * cos(t);
          const y = this.radius * sin(t);
          const z = this.radius * zScale * sin(frequency * t);
          this.points.push(createVector(x, y, z));
        }
        break;
    }
  }

  addNewWord() {
    if (this.isCollector || this.activeWords.length >= 5) return;
    
    const neededType = currentTemplate[templatePosition];
    const neededCount = this.activeWords.filter(w => w.type === neededType).length;
    
    if (neededCount < MIN_REQUIRED_WORDS) {
      this.addWordOfType(neededType);
      return;
    }
    
    if (random() < 0.7) {
      this.addWordOfType(neededType);
    } else {
      const otherTypes = Object.keys(wordDictionary).filter(t => t !== neededType);
      if (otherTypes.length > 0) {
        this.addWordOfType(random(otherTypes));
      }
    }
  }

  addWordOfType(type) {
    let availableWords = wordDictionary[type].filter(w => !USED_WORDS.has(w));
    
    if (availableWords.length === 0) {
      wordDictionary[type].forEach(w => USED_WORDS.delete(w));
      availableWords = [...wordDictionary[type]];
    }
    
    if (availableWords.length > 0) {
      const newWord = random(availableWords);
      this.activeWords.push(new Word(newWord, type, this));
      USED_WORDS.add(newWord);
    }
  }

  getPosition(progress) {
    if (this.isCollector) return this.lineStart.copy();
    
    if (this.type === 'line') {
      const pingPongProgress = progress % 2;
      return pingPongProgress <= 1 ? 
        p5.Vector.lerp(this.points[0], this.points[1], pingPongProgress) :
        p5.Vector.lerp(this.points[1], this.points[0], pingPongProgress - 1);
    } else if (this.type === 'sine') {
      const t = progress * TWO_PI;
      return createVector(
        this.radius * cos(t),
        this.radius * sin(t),
        this.radius * 0.8 * sin(7 * t)
      );
    }
  }

  checkVisualCenter(word) {
    const proj = this.project(word.position);
    return dist(proj.x, proj.y, width/2, height/2) < CENTER_THRESHOLD;
  }

  update() {
    if (this.isCollector) return;
    
    this.activeWords = this.activeWords.filter(word => {
      return this.type === 'line' ? word.progress < 2 : word.progress < 1;
    });
    
    if (random() < 0.3 * speedMultiplier) {
      this.addNewWord();
    }
  }

  project(point) {
    let x = point.x;
    let y = point.y;
    let z = point.z;
    
    let tempY = y * cos(boxRotation.x) - z * sin(boxRotation.x);
    let tempZ = y * sin(boxRotation.x) + z * cos(boxRotation.x);
    let tempX = x * cos(boxRotation.y) + tempZ * sin(boxRotation.y);
    tempZ = -x * sin(boxRotation.y) + tempZ * cos(boxRotation.y);
    
    return createVector(
      map(tempX, -BOX_SIZE/2, BOX_SIZE/2, 0, width),
      map(tempY, -BOX_SIZE/2, BOX_SIZE/2, 0, height)
    );
  }

  draw() {
    stroke(255);
    strokeWeight(1);
    drawingContext.setLineDash(this.isCollector ? [] : [5, 3]);
    noFill();
    
    beginShape();
    this.points.forEach(p => {
      let proj = this.project(p);
      vertex(proj.x, proj.y);
    });
    endShape();
    
    if (this.isCollector) {
      fill(255, 30);
      noStroke();
      ellipse(width/2, height/2, CENTER_THRESHOLD*2);
    }
  }
}

class Word {
  constructor(text, type, trajectory) {
    this.text = text;
    this.type = type;
    this.trajectory = trajectory;
    this.position = trajectory.points[0].copy();
    this.progress = 0;
    this.speed = random(0.0005, 0.0008);
    this.isOnCollector = false;
    this.hasBeenCollected = false;
    this.collectionChecked = false;
  }

  update() {
    if (this.isOnCollector) return;
    
    this.progress += this.speed * speedMultiplier;
    this.position = this.trajectory.getPosition(this.progress);
    
    if (this.trajectory.checkVisualCenter(this) && !this.collectionChecked) {
      this.checkCollection();
      this.collectionChecked = true;
    } else if (!this.trajectory.checkVisualCenter(this)) {
      this.collectionChecked = false;
    }
  }

  checkCollection() {
    if (this.hasBeenCollected) return;
    
    const expectedType = currentTemplate[templatePosition];
    if (this.type === expectedType) {
      const typeAlreadyInCollector = collectedWords.some(w => w.type === this.type);
      if (!typeAlreadyInCollector) {
        this.moveToCollector();
        collectedWords.push(this);
        this.hasBeenCollected = true;
        
        if (templatePosition < currentTemplate.length - 1) {
          templatePosition++;
        } else {
          this.completePhrase();
        }
        
        this.trajectory.activeWords = this.trajectory.activeWords.filter(w => w !== this);
      }
    }
  }

  moveToCollector() {
    if (!this.isOnCollector) {
        this.isOnCollector = true;
        this.hasBeenCollected = true;
        
        // Позиционируем слова строго вдоль линии коллектора
        const collector = trajectories.find(t => t.isCollector);
        const segment = collector.points[1].copy().sub(collector.points[0]);
        const step = segment.div(collectedWords.length + 1);
        this.position = collector.points[0].copy().add(step.mult(collectedWords.length));
    }
}

  completePhrase() {
    const phrase = collectedWords.map(w => w.text).join(' ');
    completedPhrases.push(phrase);
    
    setTimeout(() => {
      collectedWords.forEach(w => {
        USED_WORDS.delete(w.text);
        w.hasBeenCollected = false;
      });
      collectedWords = [];
      currentTemplate = random(phraseTemplates);
      templatePosition = 0;
      
      trajectories.forEach(t => {
        if (!t.isCollector) t.activeWords = [];
      });
    }, 2000);
  }

  draw() {
    // Сохраняем текущие настройки стиля линии
    const prevLineDash = drawingContext.getLineDash();
    const prevStrokeStyle = drawingContext.strokeStyle;
    
    // Убедимся, что для текста нет пунктира
    drawingContext.setLineDash([]);
    
    if (this.isOnCollector) {
      const collectorTrajectory = trajectories.find(t => t.isCollector);
      if (collectorTrajectory) {
        const start = collectorTrajectory.lineStart;
        const end = collectorTrajectory.lineEnd;
        const t = collectedWords.indexOf(this) / (collectedWords.length - 1 || 1);
        const pos = p5.Vector.lerp(start, end, t);
        const proj = collectorTrajectory.project(pos);
        
        fill(255);
        noStroke(); // Явно отключаем обводку для текста
        textSize(28);
        textAlign(CENTER, CENTER);
        text(this.text, proj.x, proj.y);
      }
    } else {
      const proj = this.trajectory.project(this.position);
      fill(255);
      noStroke(); // Явно отключаем обводку для текста
      textSize(28);
      textAlign(CENTER, CENTER);
      text(this.text, proj.x, proj.y);
    }
    
    // Восстанавливаем предыдущие настройки стиля линии
    drawingContext.setLineDash(prevLineDash);
    drawingContext.strokeStyle = prevStrokeStyle;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textSize(28);
  
  trajectories.push(new Trajectory('line', true));
  for (let i = 0; i < 3; i++) trajectories.push(new Trajectory('line'));
  trajectories.push(new Trajectory('sine'));
  
  currentTemplate = random(phraseTemplates);
}

function draw() {
  background(0);
  
  let cursorSpeed = dist(mouseX, mouseY, pmouseX, pmouseY) / (deltaTime/1000);
  speedMultiplier = 1 + cursorSpeed * SPEED_SENSITIVITY;

  boxRotation.x = map(mouseY, 0, height, -PI/4, PI/4);
  boxRotation.y = map(mouseX, 0, width, -PI/4, PI/4);
  
  trajectories.forEach(t => {
    t.update();
    t.draw();
    t.activeWords.forEach(w => {
      w.update();
      w.draw();
    });
  });

  drawCollector();
  drawBoxFrame();
}

function drawCollector() {
  if (collectedWords.length > 0) {
    const phrase = collectedWords.map(w => w.text).join(' ');
    const tw = textWidth(phrase);
    const th = 30;
    
    // Убедимся, что для прямоугольника и текста нет пунктира
    drawingContext.setLineDash([]); // Добавлено: сброс пунктира
    // Рисуем белый фон
    fill(255);
    noStroke();
    rectMode(CENTER);
    rect(width/2, height/2, tw + TEXT_PADDING*2, th, 5);
    
    // Рисуем текст
    fill(0);
    textSize(28);
    textAlign(CENTER, CENTER);
    text(phrase, width/2, height/2);
  }
}

function drawUI() {
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(14);
  text(`Current template: ${currentTemplate.join(' → ')}`, 20, 20);
  text(`Next needed: ${currentTemplate[templatePosition]}`, 20, 40);
  text(`Progress: ${collectedWords.length}/${currentTemplate.length}`, 20, 60);
  
  if (completedPhrases.length > 0) {
    textAlign(RIGHT, BOTTOM);
    textSize(28);
    text(completedPhrases[completedPhrases.length-1], width-20, height-20);
  }
}

function drawBoxFrame() {
  stroke(255);
  strokeWeight(1);
  noFill();
  drawingContext.setLineDash([]);
  
  const corners = [];
  for(let x = -1; x <= 1; x += 2) {
    for(let y = -1; y <= 1; y += 2) {
      for(let z = -1; z <= 1; z += 2) {
        corners.push(createVector(
          x * BOX_SIZE/2,
          y * BOX_SIZE/2,
          z * BOX_SIZE/2
        ));
      }
    }
  }
  
  const edges = [
    [0,1], [1,3], [3,2], [2,0],
    [4,5], [5,7], [7,6], [6,4],
    [0,4], [1,5], [2,6], [3,7]
  ];
  
  edges.forEach(([i,j]) => {
    let p1 = trajectories[0].project(corners[i]);
    let p2 = trajectories[0].project(corners[j]);
    line(p1.x, p1.y, p2.x, p2.y);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}