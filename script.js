(() => {
  const collage = document.getElementById('collage');
  const imageUpload = document.getElementById('image-upload');
  const imagesList = document.getElementById('images-list');
  const bgColorInput = document.getElementById('background-color');
  const opacityRange = document.getElementById('opacity-range');
  const zindexRange = document.getElementById('zindex-range');
  const bringFrontBtn = document.getElementById('bring-front-btn');
  const sendBackBtn = document.getElementById('send-back-btn');
  const exportBtn = document.getElementById('export-btn');
  const clearBtn = document.getElementById('clear-btn');
  const cropBtn = document.getElementById('crop-btn');
  const removeBtn = document.getElementById('remove-btn');

  // Color correction inputs
  const brightnessRange = document.getElementById('brightness-range');
  const contrastRange = document.getElementById('contrast-range');
  const saturateRange = document.getElementById('saturate-range');
  const hueRange = document.getElementById('hue-range');

  // Crop modal elements
  const cropModal = document.getElementById('crop-modal');
  const cropImageWrapper = document.getElementById('crop-image-wrapper');
  const cropImage = document.getElementById('crop-image');
  const cropRect = document.getElementById('crop-rect');
  const cropSaveBtn = document.getElementById('crop-save-btn');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');

  const suggestedLayoutsContainer = document.getElementById('suggested-layouts');

  let selectedImage = null;
  let imagesData = [];

  // Crop state variables
  let cropDrag = null; // { startX, startY, type: 'move' or 'resize', handle, origRect }

  // Utility: create collage image element
  function createCollageImage(src, id) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('collage-image');
    wrapper.style.top = '50px';
    wrapper.style.left = '50px';
    wrapper.style.zIndex = 10;
    wrapper.style.opacity = 1;
    wrapper.setAttribute('data-id', id);
    wrapper.style.transform = 'rotate(0deg) scale(1)';
    wrapper.style.width = '150px';
    wrapper.style.height = '150px';

    const img = document.createElement('img');
    img.src = src;
    img.draggable = false;
    wrapper.appendChild(img);

    // resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.classList.add('resize-handle');
    wrapper.appendChild(resizeHandle);

    // rotate handle
    const rotateHandle = document.createElement('div');
    rotateHandle.classList.add('rotate-handle');
    wrapper.appendChild(rotateHandle);

    return wrapper;
  }

  // Add thumbnails to image list
  function addThumbnail(src, id) {
    const thumb = document.createElement('img');
    thumb.classList.add('img-thumb');
    thumb.src = src;
    thumb.setAttribute('data-id', id);
    imagesList.appendChild(thumb);

    thumb.addEventListener('click', () => {
      selectById(id);
    });
  }

  // Select an image by id
  function selectById(id) {
    if (selectedImage && selectedImage.dataset.id === id) return;
    deselectAll();
    const elem = collage.querySelector(`.collage-image[data-id="${id}"]`);
    if (elem) {
      selectedImage = elem;
      elem.classList.add('selected');
      updateControls();
      cropBtn.disabled = false;
      removeBtn.disabled = false;
      enableColorCorrectionInputs(true);
    } else {
      cropBtn.disabled = true;
      removeBtn.disabled = true;
      enableColorCorrectionInputs(false);
    }
  }

  // Deselect all
  function deselectAll() {
    if (selectedImage) {
      selectedImage.classList.remove('selected');
      selectedImage = null;
    }
    resetControls();
    cropBtn.disabled = true;
    removeBtn.disabled = true;
    enableColorCorrectionInputs(false);
  }

  // Update control inputs for selected image
  function updateControls() {
    if (!selectedImage) return;
    opacityRange.value = parseFloat(selectedImage.style.opacity) || 1;
    zindexRange.value = parseInt(selectedImage.style.zIndex) || 10;

    // Get filters data from imagesData
    const data = imagesData.find(img => img.id === selectedImage.dataset.id);
    if (data && data.filters) {
      brightnessRange.value = data.filters.brightness;
      contrastRange.value = data.filters.contrast;
      saturateRange.value = data.filters.saturate;
      hueRange.value = data.filters.hue;
    } else {
      brightnessRange.value = 100;
      contrastRange.value = 100;
      saturateRange.value = 100;
      hueRange.value = 0;
    }
  }

  // Reset controls
  function resetControls() {
    opacityRange.value = 1;
    zindexRange.value = 10;
    brightnessRange.value = 100;
    contrastRange.value = 100;
    saturateRange.value = 100;
    hueRange.value = 0;
  }

  function enableColorCorrectionInputs(enable) {
    brightnessRange.disabled = !enable;
    contrastRange.disabled = !enable;
    saturateRange.disabled = !enable;
    hueRange.disabled = !enable;
  }

  // Add images from input
  imageUpload.addEventListener('change', (e) => {
    const files = e.target.files;
    for (let file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 9);
        imagesData.push({
          id,
          src: ev.target.result,
          top: 50,
          left: 50,
          width: 150,
          height: 150,
          rotation: 0,
          scale: 1,
          opacity: 1,
          zIndex: 10,
          crop: null, // {x,y,width,height} relative to natural image size
          filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0 }
        });

        const imgElem = createCollageImage(ev.target.result, id);
        collage.appendChild(imgElem);
        addThumbnail(ev.target.result, id);
        attachImageEvents(imgElem);
        selectById(id);
        updateSuggestedLayouts();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  });

  // Attach events for drag, resize, rotate for collage image element
  function attachImageEvents(elem) {
    const resizeHandle = elem.querySelector('.resize-handle');
    const rotateHandle = elem.querySelector('.rotate-handle');

    let dragOffset = { x: 0, y: 0 };
    let origX, origY;
    let originalWidth, originalHeight;
    let originalMouseX, originalMouseY;
    let originalRotation = 0;
    let rotating = false;
    let resizing = false;

    // Drag start
    elem.addEventListener('mousedown', (e) => {
      if (e.target === resizeHandle || e.target === rotateHandle) return;
      e.preventDefault();
      bringToFront(elem);
      selectById(elem.dataset.id);
      dragOffset.x = e.clientX - elem.offsetLeft;
      dragOffset.y = e.clientY - elem.offsetTop;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDrop);
    });

    function onDrag(e) {
      e.preventDefault();
      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;
      newX = Math.min(Math.max(0, newX), collage.clientWidth - elem.offsetWidth);
      newY = Math.min(Math.max(0, newY), collage.clientHeight - elem.offsetHeight);
      elem.style.left = newX + 'px';
      elem.style.top = newY + 'px';
      updateImageDataPosition(elem);
    }

    function onDrop() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDrop);
    }

    // Resize start
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      resizing = true;
      originalWidth = elem.offsetWidth;
      originalHeight = elem.offsetHeight;
      originalMouseX = e.clientX;
      originalMouseY = e.clientY;
      selectById(elem.dataset.id);
      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', stopResize);
    });

    function onResize(e) {
      e.preventDefault();
      if (!resizing) return;
      let dx = e.clientX - originalMouseX;
      let dy = e.clientY - originalMouseY;
      let newWidth = Math.max(40, originalWidth + dx);
      let newHeight = Math.max(40, originalHeight + dy);

      elem.style.width = newWidth + 'px';
      elem.style.height = newHeight + 'px';

      updateImageDataSize(elem);
    }

    function stopResize() {
      resizing = false;
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', stopResize);
    }

    // Rotate start
    rotateHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      rotating = true;
      const rect = elem.getBoundingClientRect();
      origX = rect.left + rect.width / 2;
      origY = rect.top + rect.height / 2;

      const transform = elem.style.transform.match(/rotate\((-?\d+\.?\d*)deg\)/);
      originalRotation = transform ? parseFloat(transform[1]) : 0;

      selectById(elem.dataset.id);
      document.addEventListener('mousemove', onRotate);
      document.addEventListener('mouseup', stopRotate);
      document.body.style.cursor = 'grabbing';
    });

    function onRotate(e) {
      e.preventDefault();
      if (!rotating) return;
      let dx = e.clientX - origX;
      let dy = e.clientY - origY;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle += 90;
      const newRotation = (originalRotation + angle) % 360;
      const scale = getScaleFromTransform(elem.style.transform);
      elem.style.transform = `rotate(${newRotation.toFixed(1)}deg) scale(${scale})`;
      updateImageDataRotation(elem, newRotation);
    }

    function stopRotate() {
      rotating = false;
      document.removeEventListener('mousemove', onRotate);
      document.removeEventListener('mouseup', stopRotate);
      document.body.style.cursor = 'default';
    }

    // Select on click
    elem.addEventListener('click', (e) => {
      e.stopPropagation();
      deselectAll();
      selectById(elem.dataset.id);
    });
  }

  // Utility to extract scale from transform style
  function getScaleFromTransform(transform) {
    const scaleMatch = transform.match(/scale\(([0-9.]+)\)/);
    return scaleMatch ? parseFloat(scaleMatch[1]) : 1;
  }

  // Update imageData position from element styles
  function updateImageDataPosition(elem) {
    const id = elem.dataset.id;
    const data = imagesData.find(img => img.id === id);
    if (!data) return;
    data.left = parseInt(elem.style.left);
    data.top = parseInt(elem.style.top);
  }
  // Update imageData size from element styles
  function updateImageDataSize(elem) {
    const id = elem.dataset.id;
    const data = imagesData.find(img => img.id === id);
    if (!data) return;
    data.width = elem.offsetWidth;
    data.height = elem.offsetHeight;
  }
  // Update imageData rotation from element styles
  function updateImageDataRotation(elem, rotation) {
    const id = elem.dataset.id;
    const data = imagesData.find(img => img.id === id);
    if (!data) return;
    data.rotation = rotation;
  }

  // Update opacity for selected image
  opacityRange.addEventListener('input', (e) => {
    if (!selectedImage) return;
    const val = e.target.value;
    selectedImage.style.opacity = val;
    const data = imagesData.find(img => img.id === selectedImage.dataset.id);
    if (data) data.opacity = val;
  });

  // Update z-index for selected image
  zindexRange.addEventListener('input', (e) => {
    if (!selectedImage) return;
    const val = e.target.value;
    selectedImage.style.zIndex = val;
    const data = imagesData.find(img => img.id === selectedImage.dataset.id);
    if (data) data.zIndex = val;
  });

  // Bring selected image to front (max zIndex + 10)
  bringFrontBtn.addEventListener('click', () => {
    if (!selectedImage) return;
    let maxZ = 0;
    imagesData.forEach(img => {
      maxZ = Math.max(maxZ, img.zIndex);
    });
    selectedImage.style.zIndex = maxZ + 10;
    const data = imagesData.find(img => img.id === selectedImage.dataset.id);
    if (data) data.zIndex = maxZ + 10;
    zindexRange.value = maxZ + 10;
  });

  // Send selected image to back (min zIndex - 10 but >=1)
  sendBackBtn.addEventListener('click', () => {
    if (!selectedImage) return;
    let minZ = Infinity;
    imagesData.forEach(img => {
      minZ = Math.min(minZ, img.zIndex);
    });
    let newZ = Math.max(1, minZ - 10);
    selectedImage.style.zIndex = newZ;
    const data = imagesData.find(img => img.id === selectedImage.dataset.id);
    if (data) data.zIndex = newZ;
    zindexRange.value = newZ;
  });

  // Remove selected image
  removeBtn.addEventListener('click', () => {
    if (!selectedImage) return;
    const id = selectedImage.dataset.id;

    // Remove from DOM
    selectedImage.remove();
    // Remove thumbnail
    const thumb = imagesList.querySelector(`.img-thumb[data-id="${id}"]`);
    if (thumb) thumb.remove();
    // Remove from imagesData
    imagesData = imagesData.filter(img => img.id !== id);
    selectedImage = null;
    resetControls();
    cropBtn.disabled = true;
    removeBtn.disabled = true;
    enableColorCorrectionInputs(false);
    updateSuggestedLayouts();
  });

  // Background color change
  bgColorInput.addEventListener('input', (e) => {
    collage.style.backgroundColor = e.target.value;
  });

  // Clear all images from collage
  clearBtn.addEventListener('click', () => {
    while (collage.firstChild) {
      collage.removeChild(collage.firstChild);
    }
    imagesData = [];
    imagesList.innerHTML = '';
    selectedImage = null;
    resetControls();
    cropBtn.disabled = true;
    removeBtn.disabled = true;
    enableColorCorrectionInputs(false);
    updateSuggestedLayouts();
  });

  // Deselect image when clicking outside
  document.addEventListener('click', (e) => {
    if (!collage.contains(e.target)) {
      deselectAll();
    }
  });

  // Export collage as PNG
  exportBtn.addEventListener('click', () => {
    exportCollage();
  });

  // Export logic handled here (including cropping and filters)
  function exportCollage() {
    const canvas = document.createElement('canvas');
    canvas.width = collage.clientWidth;
    canvas.height = collage.clientHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = collage.style.backgroundColor || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sortedImages = imagesData.slice().sort((a,b) => a.zIndex - b.zIndex);

    Promise.all(sortedImages.map(imgData => {
      return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve({image, imgData});
        image.onerror = () => resolve(null);
        image.src = imgData.src;
      });
    })).then(results => {
      results.forEach(item => {
        if (!item) return;
        const {image, imgData} = item;
        ctx.save();

        // Translate to image center
        const centerX = imgData.left + imgData.width / 2;
        const centerY = imgData.top + imgData.height / 2;
        ctx.translate(centerX, centerY);

        // Rotate
        ctx.rotate((imgData.rotation * Math.PI) / 180);

        // Set opacity
        ctx.globalAlpha = imgData.opacity;

        // Set filters
        const b = imgData.filters?.brightness ?? 100;
        const c = imgData.filters?.contrast ?? 100;
        const s = imgData.filters?.saturate ?? 100;
        const h = imgData.filters?.hue ?? 0;
        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg)`;

        if (imgData.crop) {
          const cropX = imgData.crop.x;
          const cropY = imgData.crop.y;
          const cropW = imgData.crop.width;
          const cropH = imgData.crop.height;
          ctx.drawImage(
            image,
            cropX, cropY, cropW, cropH,
            -imgData.width / 2, -imgData.height / 2,
            imgData.width, imgData.height
          );
        } else {
          ctx.drawImage(image, -imgData.width / 2, -imgData.height / 2, imgData.width, imgData.height);
        }
        ctx.restore();
      });

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'collage.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }, 'image/png');
    });
  }

  // Bring an element to front (highest zIndex + 1)
  function bringToFront(elem) {
    let maxZ = 0;
    imagesData.forEach(img => {
      maxZ = Math.max(maxZ, img.zIndex);
    });
    elem.style.zIndex = maxZ + 1;
    const data = imagesData.find(img => img.id === elem.dataset.id);
    if (data) data.zIndex = maxZ + 1;
  }

  // Suggested layouts including fancy shapes

  // Utility to create shape points scaled and translated
  function scaleTranslatePoints(points, width, height, offsetX = 0, offsetY = 0) {
    return points.map(({x,y}) => ({
      left: x * width + offsetX,
      top: y * height + offsetY
    }));
  }

  // Fancy shapes normalized coordinates for 10 points or fewer, repeated if needed
  // Heart shape points roughly arranged to position few images
  const heartShape = [
    {x: 0.5, y: 0.15},
    {x: 0.28, y: 0.35},
    {x: 0.72, y: 0.35},
    {x: 0.15, y: 0.6},
    {x: 0.5, y: 0.75},
    {x: 0.85, y: 0.6},
    {x: 0.35, y: 0.9},
    {x: 0.65, y: 0.9},
  ];
  // Leaf shape
  const leafShape = [
    {x: 0.5, y: 0.05},
    {x: 0.3, y: 0.25},
    {x: 0.7, y: 0.25},
    {x: 0.2, y: 0.55},
    {x: 0.8, y: 0.55},
    {x: 0.4, y: 0.85},
    {x: 0.6, y: 0.85}
  ];
  // Flower shape ~8 petals + center
  const flowerShape = [
    {x: 0.5, y: 0.5},  // center
    {x: 0.5, y: 0.15}, // top petal
    {x: 0.75, y: 0.25},
    {x: 0.85, y: 0.5},
    {x: 0.75, y: 0.75},
    {x: 0.5, y: 0.85},
    {x: 0.25, y: 0.75},
    {x: 0.15, y: 0.5},
    {x: 0.25, y: 0.25}
  ];

  // Add more helper layouts
  const layouts = [
    {
      id: 'grid',
      name: 'Grid',
      description: 'Arranges images in grid layout',
      render: function(imagesCount, containerWidth, containerHeight) {
        const cols = Math.ceil(Math.sqrt(imagesCount));
        const rows = Math.ceil(imagesCount / cols);
        const cellWidth = containerWidth / cols;
        const cellHeight = containerHeight / rows;
        let positions = [];
        for (let i = 0; i < imagesCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            left: col * cellWidth,
            top: row * cellHeight,
            width: cellWidth,
            height: cellHeight,
            rotation: 0,
          });
        }
        return positions;
      },
      thumbnail: function() {
        const div = document.createElement('div');
        const rows = 2; const cols = 3;
        const cellW = 20;
        const cellH = 18;
        for(let r=0;r<rows;r++) {
          for(let c=0;c<cols;c++) {
            let d = document.createElement('div');
            d.style.position = 'absolute';
            d.style.backgroundColor = '#6789ab';
            d.style.borderRadius = '2px';
            d.style.left = (c * cellW + 4) + 'px';
            d.style.top = (r * cellH + 4) + 'px';
            d.style.width = (cellW - 6) + 'px';
            d.style.height = (cellH - 6) + 'px';
            div.appendChild(d);
          }
        }
        div.style.position = 'relative';
        div.style.width = '90px';
        div.style.height = '70px';
        div.style.borderRadius = '10px';
        return div;
      }
    },
    {
      id: 'row',
      name: 'Row',
      description: 'Arranges images in a horizontal row',
      render: function(imagesCount, containerWidth, containerHeight) {
        const width = containerWidth / imagesCount;
        const height = containerHeight * 0.9;
        let positions = [];
        for(let i=0; i<imagesCount; i++) {
          positions.push({
            left: i * width,
            top: (containerHeight - height)/2,
            width: width,
            height: height,
            rotation: 0,
          });
        }
        return positions;
      },
      thumbnail: function() {
        const div = document.createElement('div');
        const imagesCount = 4;
        const width = 21;
        const height = 62;
        for(let i=0; i<imagesCount; i++) {
          let d = document.createElement('div');
          d.style.position = 'absolute';
          d.style.backgroundColor = '#8fa9c6';
          d.style.borderRadius = '3px';
          d.style.left = (i * width + 4) + 'px';
          d.style.top = '4px';
          d.style.width = (width - 8) + 'px';
          d.style.height = (height - 8) + 'px';
          div.appendChild(d);
        }
        div.style.position = 'relative';
        div.style.width = '90px';
        div.style.height = '70px';
        div.style.borderRadius = '10px';
        return div;
      }
    },
    {
      id: 'column',
      name: 'Column',
      description: 'Arranges images in a vertical column',
      render: function(imagesCount, containerWidth, containerHeight) {
        const height = containerHeight / imagesCount;
        const width = containerWidth * 0.9;
        let positions = [];
        for(let i=0; i<imagesCount; i++) {
          positions.push({
            left: (containerWidth - width)/2,
            top: i * height,
            width: width,
            height: height,
            rotation: 0,
          });
        }
        return positions;
      },
      thumbnail: function() {
        const div = document.createElement('div');
        const imagesCount = 4;
        const width = 62;
        const height = 17;
        for(let i=0; i<imagesCount; i++) {
          let d = document.createElement('div');
          d.style.position = 'absolute';
          d.style.backgroundColor = '#7a95bb';
          d.style.borderRadius = '3px';
          d.style.left = '4px';
          d.style.top = (i * height + 4) + 'px';
          d.style.width = (width - 8) + 'px';
          d.style.height = (height - 8) + 'px';
          div.appendChild(d);
        }
        div.style.position = 'relative';
        div.style.width = '90px';
        div.style.height = '70px';
        div.style.borderRadius = '10px';
        return div;
      }
    },
    // {
    //   id: 'heart',
    //   name: 'Heart Shape',
    //   description: 'Arranges images in a heart shape',
    //   render: function(imagesCount, containerWidth, containerHeight) {
    //     // Repeat points if more images than points
    //     const points = [];
    //     for(let i=0;i<imagesCount;i++) {
    //       points.push(heartShape[i % heartShape.length]);
    //     }
    //     // Scale to container size using 60% width and height
    //     const scaleW = containerWidth * 0.6;
    //     const scaleH = containerHeight * 0.7;
    //     // Center offset
    //     const offsetX = containerWidth * 0.2;
    //     const offsetY = containerHeight * 0.15;
    //     const posPoints = scaleTranslatePoints(points, scaleW, scaleH, offsetX, offsetY);
    //     const width = scaleW * 0.3;
    //     const height = scaleH * 0.22;
    //     return posPoints.map(p => ({
    //       left: p.left,
    //       top: p.top,
    //       width,
    //       height,
    //       rotation: 0
    //     }));
    //   },
    //   thumbnail: function() {
    //     const div = document.createElement('div');
    //     const coords = [
    //       {x:45,y:10},{x:20,y:30},{x:70,y:30},{x:10,y:55},{x:45,y:70},
    //       {x:80,y:55},{x:35,y:95},{x:65,y:95}
    //     ];
    //     coords.forEach(c=>{
    //       let d = document.createElement('div');
    //       d.style.position = 'absolute';
    //       d.style.left = c.x + 'px';
    //       d.style.top = c.y + 'px';
    //       d.style.width = '14px';
    //       d.style.height = '14px';
    //       d.style.backgroundColor = '#e94a60';
    //       d.style.borderRadius = '50%';
    //       div.appendChild(d);
    //     });
    //     div.style.position = 'relative';
    //     div.style.width = '90px';
    //     div.style.height = '70px';
    //     div.style.borderRadius = '10px';
    //     return div;
    //   }
    // },
    // {
    //   id: 'leaf',
    //   name: 'Leaf Shape',
    //   description: 'Arranges images in a leaf shape',
    //   render: function(imagesCount, containerWidth, containerHeight) {
    //     const points = [];
    //     for(let i=0;i<imagesCount;i++) {
    //       points.push(leafShape[i % leafShape.length]);
    //     }
    //     const scaleW = containerWidth * 0.4;
    //     const scaleH = containerHeight * 0.7;
    //     const offsetX = containerWidth * 0.3;
    //     const offsetY = containerHeight * 0.15;
    //     const posPoints = scaleTranslatePoints(points, scaleW, scaleH, offsetX, offsetY);
    //     const width = scaleW * 0.3;
    //     const height = scaleH * 0.22;
    //     return posPoints.map(p => ({
    //       left: p.left,
    //       top: p.top,
    //       width,
    //       height,
    //       rotation: 0
    //     }));
    //   },
    //   thumbnail: function() {
    //     const div = document.createElement('div');
    //     const coords = [
    //       {x:45,y:2},{x:25,y:20},{x:65,y:20},{x:15,y:50},{x:75,y:50},
    //       {x:38,y:80},{x:58,y:80}
    //     ];
    //     coords.forEach(c=>{
    //       let d = document.createElement('div');
    //       d.style.position = 'absolute';
    //       d.style.left = c.x + 'px';
    //       d.style.top = c.y + 'px';
    //       d.style.width = '16px';
    //       d.style.height = '16px';
    //       d.style.backgroundColor = '#4caf50';
    //       d.style.borderRadius = '50%';
    //       div.appendChild(d);
    //     });
    //     div.style.position = 'relative';
    //     div.style.width = '90px';
    //     div.style.height = '70px';
    //     div.style.borderRadius = '10px';
    //     return div;
    //   }
    // },
    // {
    //   id: 'flower',
    //   name: 'Flower Shape',
    //   description: 'Arranges images in a flower shape',
    //   render: function(imagesCount, containerWidth, containerHeight) {
    //     const points = [];
    //     for(let i=0; i<imagesCount; i++) {
    //       points.push(flowerShape[i % flowerShape.length]);
    //     }
    //     const scaleW = containerWidth * 0.6;
    //     const scaleH = containerHeight * 0.6;
    //     const offsetX = containerWidth * 0.2;
    //     const offsetY = containerHeight * 0.2;
    //     const posPoints = scaleTranslatePoints(points, scaleW, scaleH, offsetX, offsetY);
    //     const width = scaleW * 0.22;
    //     const height = scaleH * 0.22;
    //     return posPoints.map(p => ({
    //       left: p.left,
    //       top: p.top,
    //       width,
    //       height,
    //       rotation: 0,
    //     }));
    //   },
    //   thumbnail: function() {
    //     const div = document.createElement('div');
    //     const coords = [
    //       {x:45,y:45},
    //       {x:45,y:10},{x:70,y:20},{x:80,y:45},{x:70,y:70},{x:45,y:80},
    //       {x:20,y:70},{x:10,y:45},{x:20,y:20}
    //     ];
    //     coords.forEach((c,i)=>{
    //       let d = document.createElement('div');
    //       d.style.position = 'absolute';
    //       d.style.left = c.x + 'px';
    //       d.style.top = c.y + 'px';
    //       d.style.width = (i===0?18:12) + 'px';
    //       d.style.height = (i===0?18:12) + 'px';
    //       d.style.backgroundColor = (i===0? '#ffeb3b' : '#ff5722');
    //       d.style.borderRadius = '50%';
    //       div.appendChild(d);
    //     });
    //     div.style.position = 'relative';
    //     div.style.width = '90px';
    //     div.style.height = '70px';
    //     div.style.borderRadius = '10px';
    //     return div;
    //   }
    // }
  ];

  // Render suggested layout thumbnails
  function renderSuggestedLayouts() {
    suggestedLayoutsContainer.innerHTML = '<h3>Suggested Layouts</h3>';
    layouts.forEach(layout => {
      const thumb = document.createElement('div');
      thumb.classList.add('layout-thumb');
      thumb.title = layout.name + ': ' + layout.description;
      thumb.appendChild(layout.thumbnail());
      thumb.dataset.layoutId = layout.id;

      thumb.addEventListener('click', () => {
        applyLayout(layout.id);
        Array.from(suggestedLayoutsContainer.querySelectorAll('.layout-thumb')).forEach(el => el.classList.remove('selected'));
        thumb.classList.add('selected');
        deselectAll();
      });

      suggestedLayoutsContainer.appendChild(thumb);
    });
  }

  // Apply a layout to the images on collage
  function applyLayout(layoutId) {
    const layout = layouts.find(l => l.id === layoutId);
    if (!layout) return;

    const containerWidth = collage.clientWidth;
    const containerHeight = collage.clientHeight;
    const positions = layout.render(imagesData.length, containerWidth, containerHeight);

    imagesData.forEach((imgData, i) => {
      if (!positions[i]) return;
      imgData.left = positions[i].left;
      imgData.top = positions[i].top;
      imgData.width = positions[i].width;
      imgData.height = positions[i].height;
      imgData.rotation = positions[i].rotation || 0;

      const elem = collage.querySelector(`.collage-image[data-id="${imgData.id}"]`);
      if (!elem) return;
      elem.style.left = imgData.left + 'px';
      elem.style.top = imgData.top + 'px';
      elem.style.width = imgData.width + 'px';
      elem.style.height = imgData.height + 'px';
      elem.style.transform = `rotate(${imgData.rotation}deg) scale(1)`;
      updateImageDataRotation(elem, imgData.rotation);
      applyFiltersToElement(elem, imgData.filters);
      updateCollageImageCrop(imgData.id);
    });
  }

  function updateSuggestedLayouts() {
    renderSuggestedLayouts();
  }

  // Crop functionality

  cropBtn.addEventListener('click', () => {
    if (!selectedImage) return;
    openCropModal(selectedImage.dataset.id);
  });

  let cropOriginalImage = null;
  let croppingImageData = null;

  function openCropModal(id) {
    const data = imagesData.find(img => img.id === id);
    if (!data) return;

    croppingImageData = data;

    cropOriginalImage = new Image();
    cropOriginalImage.crossOrigin = "anonymous";
    cropOriginalImage.onload = () => {
      setupCropUI();
      cropModal.classList.add('active');
      cropModal.setAttribute('aria-hidden', 'false');
    };
    cropOriginalImage.src = data.src;
  }

  function closeCropModal() {
    cropModal.classList.remove('active');
    cropModal.setAttribute('aria-hidden', 'true');
    croppingImageData = null;
    cropOriginalImage = null;
  }

  let cropRectPos = { x: 0, y: 0, width: 100, height: 100 };
  let cropWrapperRect = null;
  let naturalImageSize = { width: 0, height: 0 };

  function setupCropUI() {
    cropImage.src = croppingImageData.src;

    naturalImageSize.width = cropOriginalImage.naturalWidth;
    naturalImageSize.height = cropOriginalImage.naturalHeight;

    const wrapperBounds = cropImageWrapper.getBoundingClientRect();
    cropWrapperRect = wrapperBounds;

    const prevCrop = croppingImageData.crop;
    if (prevCrop) {
      cropRectPos = {
        x: (prevCrop.x / naturalImageSize.width) * wrapperBounds.width,
        y: (prevCrop.y / naturalImageSize.height) * wrapperBounds.height,
        width: (prevCrop.width / naturalImageSize.width) * wrapperBounds.width,
        height: (prevCrop.height / naturalImageSize.height) * wrapperBounds.height,
      };
    } else {
      cropRectPos = {
        x: 0,
        y: 0,
        width: wrapperBounds.width,
        height: wrapperBounds.height,
      };
    }
    updateCropRect();
  }

  function updateCropRect() {
    cropRect.style.left = cropRectPos.x + 'px';
    cropRect.style.top = cropRectPos.y + 'px';
    cropRect.style.width = cropRectPos.width + 'px';
    cropRect.style.height = cropRectPos.height + 'px';
  }

  cropRect.addEventListener('mousedown', cropMouseDown);
  cropRect.addEventListener('touchstart', cropTouchStart, {passive:false});

  function cropMouseDown(e) {
    e.preventDefault();
    if (e.target.classList.contains('handle')) {
      cropDrag = { type: 'resize', handle: e.target.dataset.handle, startX: e.clientX, startY: e.clientY, origRect: {...cropRectPos} };
    } else {
      cropDrag = { type: 'move', startX: e.clientX, startY: e.clientY, origRect: {...cropRectPos} };
    }
    window.addEventListener('mousemove', cropMouseMove);
    window.addEventListener('mouseup', cropMouseUp);
  }

  function cropTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (e.target.classList.contains('handle')) {
      cropDrag = { type: 'resize', handle: e.target.dataset.handle, startX: touch.clientX, startY: touch.clientY, origRect: {...cropRectPos} };
    } else {
      cropDrag = { type: 'move', startX: touch.clientX, startY: touch.clientY, origRect: {...cropRectPos} };
    }
    window.addEventListener('touchmove', cropTouchMove, {passive:false});
    window.addEventListener('touchend', cropTouchEnd);
  }

  function cropMouseMove(e) {
    e.preventDefault();
    cropHandleMove(e.clientX, e.clientY);
  }
  function cropTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    cropHandleMove(touch.clientX, touch.clientY);
  }

  function cropHandleMove(clientX, clientY) {
    if (!cropDrag) return;
    const deltaX = clientX - cropDrag.startX;
    const deltaY = clientY - cropDrag.startY;
    let newRect = {...cropDrag.origRect};

    if (cropDrag.type === 'move') {
      newRect.x += deltaX;
      newRect.y += deltaY;
      newRect.x = Math.min(Math.max(0, newRect.x), cropWrapperRect.width - newRect.width);
      newRect.y = Math.min(Math.max(0, newRect.y), cropWrapperRect.height - newRect.height);
    } else if (cropDrag.type === 'resize') {
      switch(cropDrag.handle) {
        case 'nw': {
          newRect.x += deltaX;
          newRect.y += deltaY;
          newRect.width -= deltaX;
          newRect.height -= deltaY;
          break;
        }
        case 'n': {
          newRect.y += deltaY;
          newRect.height -= deltaY;
          break;
        }
        case 'ne': {
          newRect.y += deltaY;
          newRect.width += deltaX;
          newRect.height -= deltaY;
          break;
        }
        case 'e': {
          newRect.width += deltaX;
          break;
        }
        case 'se': {
          newRect.width += deltaX;
          newRect.height += deltaY;
          break;
        }
        case 's': {
          newRect.height += deltaY;
          break;
        }
        case 'sw': {
          newRect.x += deltaX;
          newRect.width -= deltaX;
          newRect.height += deltaY;
          break;
        }
        case 'w': {
          newRect.x += deltaX;
          newRect.width -= deltaX;
          break;
        }
      }
      if (newRect.width < 20) newRect.width = 20;
      if (newRect.height < 20) newRect.height = 20;
      if (newRect.x < 0) newRect.x = 0;
      if (newRect.y < 0) newRect.y = 0;
      if (newRect.x + newRect.width > cropWrapperRect.width) newRect.x = cropWrapperRect.width - newRect.width;
      if (newRect.y + newRect.height > cropWrapperRect.height) newRect.y = cropWrapperRect.height - newRect.height;
    }

    cropRectPos = newRect;
    updateCropRect();
  }

  function cropMouseUp(e) {
    e.preventDefault();
    cropDrag = null;
    window.removeEventListener('mousemove', cropMouseMove);
    window.removeEventListener('mouseup', cropMouseUp);
  }

  function cropTouchEnd(e) {
    e.preventDefault();
    cropDrag = null;
    window.removeEventListener('touchmove', cropTouchMove);
    window.removeEventListener('touchend', cropTouchEnd);
  }

  cropSaveBtn.addEventListener('click', () => {
    if (!croppingImageData || !cropOriginalImage) return;

    const scaleX = naturalImageSize.width / cropWrapperRect.width;
    const scaleY = naturalImageSize.height / cropWrapperRect.height;

    const cropX = Math.round(cropRectPos.x * scaleX);
    const cropY = Math.round(cropRectPos.y * scaleY);
    const cropWidth = Math.round(cropRectPos.width * scaleX);
    const cropHeight = Math.round(cropRectPos.height * scaleY);

    croppingImageData.crop = {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight
    };

    updateCollageImageCrop(croppingImageData.id);
    closeCropModal();
  });

  cropCancelBtn.addEventListener('click', () => {
    closeCropModal();
  });

  function updateCollageImageCrop(id) {
    const data = imagesData.find(img => img.id === id);
    if (!data) return;
    const elem = collage.querySelector(`.collage-image[data-id="${id}"]`);
    if (!elem) return;
    const imgElem = elem.querySelector('img');
    if (!imgElem) return;

    if (data.crop) {
      imgElem.style.objectFit = 'none';
      const posX = -(data.crop.x / cropOriginalImage.naturalWidth ?? 1) * 100;
      const posY = -(data.crop.y / cropOriginalImage.naturalHeight ?? 1) * 100;
      imgElem.style.objectPosition = `${posX}% ${posY}%`;

      const scaleX = cropOriginalImage.naturalWidth / data.crop.width;
      const scaleY = cropOriginalImage.naturalHeight / data.crop.height;
      const scale = Math.min(scaleX, scaleY);
      imgElem.style.width = `${cropOriginalImage.naturalWidth / scale}px`;
      imgElem.style.height = `${cropOriginalImage.naturalHeight / scale}px`;
    } else {
      imgElem.style.objectFit = '';
      imgElem.style.objectPosition = '';
      imgElem.style.width = '';
      imgElem.style.height = '';
    }
  }

  // On image load or update -- apply cropping preview in collage
  function refreshAllCrops() {
    imagesData.forEach(imgData => updateCollageImageCrop(imgData.id));
  }

  // Color correction sliders handlers and applying filters live
  function applyFiltersToElement(elem, filters) {
    if (!filters) return;
    const filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) hue-rotate(${filters.hue}deg)`;
    const imgElem = elem.querySelector('img');
    if (imgElem) imgElem.style.filter = filterString;
  }

  brightnessRange.addEventListener('input', () => {
    updateFilter('brightness', parseInt(brightnessRange.value));
  });
  contrastRange.addEventListener('input', () => {
    updateFilter('contrast', parseInt(contrastRange.value));
  });
  saturateRange.addEventListener('input', () => {
    updateFilter('saturate', parseInt(saturateRange.value));
  });
  hueRange.addEventListener('input', () => {
    updateFilter('hue', parseInt(hueRange.value));
  });

  function updateFilter(filterName, value) {
    if (!selectedImage) return;
    const id = selectedImage.dataset.id;
    const data = imagesData.find(img => img.id === id);
    if (!data) return;
    if (!data.filters) data.filters = { brightness: 100, contrast: 100, saturate: 100, hue: 0 };
    data.filters[filterName] = value;
    applyFiltersToElement(selectedImage, data.filters);
  }

  // Initial render suggested layouts
  renderSuggestedLayouts();

  // Refresh all filter/application and cropping preview on window resize crop modal
  window.addEventListener('resize', () => {
    if (cropModal.classList.contains('active')) {
      setupCropUI();
    }
  });

})();