// PROCESSING TEXTUAL CONTENT

const PUNCTUATION_REGEX = /[.;?!]/;

// Helper function to check if element is visible
function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0';
}

// Helper function to check if element has no element children (leaf node)
function isLeafElement(element) {
  return element.children.length === 0;
}

// Helper function to check if element is a line break
function isLineBreak(element) {
  return element.tagName === 'BR';
}

// Helper function to check if element is a thematic break
function isThematicBreak(element) {
  return element.tagName === 'HR';
}

// Split text by sentence-ending punctuation, keeping the punctuation
function splitBySentences(text) {
  const sentences = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    current += text[i];
    // Check if this is sentence-ending punctuation
    if (PUNCTUATION_REGEX.test(text[i])) {
      // Collect any additional consecutive punctuation marks
      let j = i + 1;
      while (j < text.length && PUNCTUATION_REGEX.test(text[j])) {
        current += text[j];
        j++;
      }
      // Update i to skip the consecutive punctuation we just added
      i = j - 1;
      // Look ahead for whitespace after all the punctuation
      if (j < text.length && /\s/.test(text[j])) {
        sentences.push(current);
        current = '';
      } else if (j === text.length) {
        // End of text
        sentences.push(current);
        current = '';
      }
    }
  }
  if (current.trim()) {
    sentences.push(current);
  }
  return sentences;
}

function processBufferToResults(textBuffer, results) {
  const containerResults = [...results];
  if (!textBuffer.trim()) return containerResults;
  // Split buffer by sentences
  const sentences = splitBySentences(textBuffer);
  // Create p-tag for each sentence
  for (const sentence of sentences) {
    if (sentence.trim()) {
      const p = document.createElement('p');
      p.textContent = sentence.trim();
      containerResults.push(p);
    }
  }
  return containerResults;
}

function processLineForSentences(line, buffer, results) {
  let updatedBuffer = buffer + line;
  let updatedResults = [...results];
  const sentences = splitBySentences(updatedBuffer);
  // Save complete sentences and keep incomplete in buffer
  if (sentences.length > 1) {
    // Process all complete sentences
    for (let i = 0; i < sentences.length - 1; i++) {
      if (sentences[i].trim()) {
        const p = document.createElement('p');
        p.textContent = sentences[i].trim();
        updatedResults.push(p);
      }
    }
    // Keep last part (might be incomplete)
    updatedBuffer = sentences[sentences.length - 1];
  }
  return { buffer: updatedBuffer, results: updatedResults };
}

function flushLineBuffer(buffer, results) {
  let updatedResults = [...results];
  // Create p-tag from remaining buffer content
  if (buffer.trim()) {
    const p = document.createElement('p');
    p.textContent = buffer.trim();
    updatedResults.push(p);
  }
  // Reset buffer
  return { buffer: '', results: updatedResults };
}

function splitTextIntoLines(text) {
  return text.split('\n');
}

function processTextNode(text, textBuffer, containerResults) {
  let updatedBuffer = textBuffer;
  let updatedResults = [...containerResults];
  const lines = splitTextIntoLines(text);
  const isLastLine = (index) => index === lines.length - 1;
  // Process each line separately
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    // Check if line contains sentence-ending punctuation
    if (PUNCTUATION_REGEX.test(line)) {
      const result = processLineForSentences(line, updatedBuffer, updatedResults);
      updatedBuffer = result.buffer;
      updatedResults = result.results;
    } else {
      // Add to buffer without processing
      updatedBuffer += line;
    }
    // Flush buffer at line boundaries (newlines create p-tag boundaries)
    if (!isLastLine(lineIndex)) {
      const result = flushLineBuffer(updatedBuffer, updatedResults);
      updatedBuffer = result.buffer;
      updatedResults = result.results;
    }
  }
  return { buffer: updatedBuffer, results: updatedResults };
}

function getFollowingText(element) {
  let followingText = '';
  let nextNode = element.nextSibling;
  // Look for next text node
  while (nextNode) {
    if (nextNode.nodeType === Node.TEXT_NODE) {
      followingText = nextNode.textContent;
      break;
    } else if (nextNode.nodeType === Node.ELEMENT_NODE) {
      // Another element follows
      break;
    }
    nextNode = nextNode.nextSibling;
  }
  return followingText;
}

function hasElementSurroundingText(precedingText, followingText) {
  const followingStartsWithPunctuation = /^[^\w\s]/.test(followingText.trimStart());
  // Check if element is wrapped in text or followed by punctuation
  return precedingText.length > 0 || 
    (followingText.trim().length > 0 && 
     !followingText.trimStart().match(/^[.;?!]\s/) &&
     followingStartsWithPunctuation);
}

function processLeafElement(child, textBuffer, containerResults) {
  let updatedBuffer = textBuffer;
  let updatedResults = [...containerResults];
  const elementTextContent = child.textContent.trim();
  const precedingText = textBuffer.trim();
  const followingText = getFollowingText(child);
  const followingStartsWithPunctuation = /^[^\w\s]/.test(followingText.trimStart());
  const hasSurroundingText = hasElementSurroundingText(precedingText, followingText);
  if (hasSurroundingText || followingStartsWithPunctuation) {
    // Element has surrounding text - add to buffer
    updatedBuffer += elementTextContent;
  } else {
    // Element is standalone - flush buffer and add element
    updatedResults = processBufferToResults(updatedBuffer, updatedResults);
    const clonedElement = child.cloneNode(true);
    // Normalize text: trim and remove newlines
    clonedElement.textContent = clonedElement.textContent.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    updatedResults.push(clonedElement);
    updatedBuffer = '';
  }
  return { buffer: updatedBuffer, results: updatedResults };
}

function processLineBreak(_child, textBuffer, containerResults) {
  // Line break acts as sentence boundary
  const updatedResults = processBufferToResults(textBuffer, containerResults);
  return { buffer: '', results: updatedResults };
}

function processThematicBreak(child, textBuffer, containerResults) {
  // Thematic break is standalone - flush buffer and add HR
  let updatedResults = processBufferToResults(textBuffer, containerResults);
  const clonedElement = child.cloneNode(true);
  // Normalize text if present
  if (clonedElement.textContent) {
    clonedElement.textContent = clonedElement.textContent.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
  }
  updatedResults.push(clonedElement);
  return { buffer: '', results: updatedResults };
}

function processNonLeafElement(child, textBuffer, containerResults) {
  // Non-leaf element - flush buffer and recurse
  let updatedResults = processBufferToResults(textBuffer, containerResults);
  const nestedResults = processContainer(child);
  updatedResults.push(...nestedResults);
  return { buffer: '', results: updatedResults };
}

function getElementProcessor(child) {
  // Return appropriate processor based on element type
  if (isLineBreak(child)) return processLineBreak;
  if (isThematicBreak(child)) return processThematicBreak;
  if (isLeafElement(child)) return processLeafElement;
  return processNonLeafElement;
}

function processContainer(container) {
  let containerResults = [];
  let textBuffer = '';
  // Iterate through all child nodes
  for (const child of container.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const result = processTextNode(child.textContent, textBuffer, containerResults);
      textBuffer = result.buffer;
      containerResults = result.results;
    } else if (child.nodeType === Node.ELEMENT_NODE && isVisible(child)) {
      // Get appropriate processor and process element
      const processor = getElementProcessor(child);
      const result = processor(child, textBuffer, containerResults);
      textBuffer = result.buffer;
      containerResults = result.results;
    }
  }
  // Handle remaining buffer after processing all children
  containerResults = processBufferToResults(textBuffer, containerResults);
  return containerResults;
}

// Main function to extract textual content according to rules
function extractVisibleTextualContent() {
  return processContainer(document.body);
}

// CREATING CANVAS & DISPLAYING CONTENT

// Calculate how long text should be displayed based on reading speed
function calculateReadingTime(text) {
  // Average reading speed: 250 words per minute = ~4.2 words per second
  // Minimum display time: 2 seconds, maximum: 8 seconds
  const wordCount = text.trim().split(/\s+/).length;
  // Calculate base time from word count
  const baseTime = (wordCount / 4.2) * 1000; // Convert to milliseconds
  // Clamp between minimum and maximum display times
  return Math.max(2000, Math.min(8000, baseTime));
}

// Create blank centered canvas for displaying content
function createCanvas() {
  // Clear existing content
  document.body.innerHTML = '';
  // Style body as flexbox container for centering
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.backgroundColor = '#ffffff';
  document.body.style.display = 'flex';
  document.body.style.justifyContent = 'center';
  document.body.style.alignItems = 'center';
  document.body.style.minHeight = '100vh';
  document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  // Create canvas div with responsive width and typography
  const canvas = document.createElement('div');
  canvas.style.width = '80%';
  canvas.style.maxWidth = '800px';
  canvas.style.padding = '40px';
  canvas.style.textAlign = 'center';
  canvas.style.fontSize = '24px';
  canvas.style.lineHeight = '1.6';
  canvas.style.color = '#333';
  // Start invisible for fade-in effect
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.8s ease-in-out';
  document.body.appendChild(canvas);
  return canvas;
}

// Display paragraph text directly on canvas
function displayParagraph(canvas, element) {
  canvas.textContent = element.textContent;
  canvas.style.fontSize = '24px';
  canvas.style.fontWeight = 'normal';
}

// Display link with custom styling and centering
function displayLink(canvas, element) {
  const link = element.cloneNode(true);
  // Style link with blue color and centered layout
  link.style.color = '#0066cc';
  link.style.textDecoration = 'none';
  link.style.fontSize = '22px';
  link.style.display = 'inline-block';
  link.style.textAlign = 'center';
  canvas.appendChild(link);
}

// Display any other element type with centering
function displayGenericElement(canvas, element) {
  const cloned = element.cloneNode(true);
  // Apply centering styles regardless of original HTML styling
  cloned.style.display = 'inline-block';
  cloned.style.textAlign = 'center';
  cloned.style.margin = '0 auto';
  canvas.appendChild(cloned);
}

// Select appropriate display function based on element type (strategy pattern)
function getDisplayStrategy(element) {
  if (element.tagName === 'P') return displayParagraph;
  if (element.tagName === 'A') return displayLink;
  return displayGenericElement;
}

// Display single element with fade transitions and reading time calculation
function displayElement(canvas, element) {
  return new Promise((resolve) => {
    // Fade out current content
    canvas.style.opacity = '0';
    const fadeOutTimeout = setTimeout(() => {
      // Clear canvas and render new element using appropriate strategy
      canvas.innerHTML = '';
      const displayStrategy = getDisplayStrategy(element);
      displayStrategy(canvas, element);
      // Fade in new content
      canvas.style.opacity = '1';
      // Calculate reading time based on text content
      const text = element.textContent || '';
      const displayTime = calculateReadingTime(text);
      // Wait for display time then resolve with timeout IDs for cleanup
      const displayTimeout = setTimeout(() => {
        resolve({ fadeOutTimeout, displayTimeout });
      }, displayTime + 800); // Add fade transition time
    }, 800); // Wait for fade out
  });
}

// Main presentation function - displays all elements sequentially with transitions
async function playTextualContent(elements) {
  const canvas = createCanvas();
  const timeouts = [];
  // Filter elements to only those with non-empty text content
  const textElements = elements.filter(el => el.textContent && el.textContent.trim().length > 0);
  // Wait a bit before starting presentation
  await new Promise(resolve => setTimeout(resolve, 500));
  // Display each element sequentially, collecting timeout IDs
  for (let i = 0; i < textElements.length; i++) {
    const result = await displayElement(canvas, textElements[i]);
    timeouts.push(result.fadeOutTimeout, result.displayTimeout);
  }
  // Fade out final element
  canvas.style.opacity = '0';
  const endTimeout = setTimeout(() => {
    // Display "The End" message
    canvas.innerHTML = '<div style="font-size: 28px; font-weight: 300;">The End</div>';
    canvas.style.opacity = '1';
    // Clear all timeouts after presentation ends (cleanup resources)
    timeouts.forEach(timeout => clearTimeout(timeout));
    clearTimeout(endTimeout);
  }, 800);
}

const textualContent = extractVisibleTextualContent();

// Start the presentation
playTextualContent(textualContent);