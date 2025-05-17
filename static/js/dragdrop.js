// Allow elements to be dropped
function allowDrop(event) {
  event.preventDefault();
}

// Handle the drag start event
function drag(event, type) {
  event.dataTransfer.setData("type", type);
  event.dataTransfer.setData("id", event.target.dataset.id);
}

// Handle the drop event
function drop(event, targetType) {
  event.preventDefault();
  const draggedId = event.dataTransfer.getData("id");
  const draggedType = event.dataTransfer.getData("type");
  const targetId = event.target.dataset.target;

  // Validate if drop is allowed
  if (isValidDrop(targetType, draggedType)) {
    // Perform the drop action
    const draggedElement = document.querySelector(`[data-id="${draggedId}"]`);
    event.target.appendChild(draggedElement);  // Append the dragged element to the target

    // Optionally, update the database with new relationships
    updateDatabase(targetType, draggedType, targetId, draggedId);

    // Resize the parent window to fit the new content
    resizeParentWindow(draggedElement);
  }
}

// Check if the drop is allowed (e.g., a project can only accept WPs, etc.)
function isValidDrop(dropType, dragType) {
  const validDrops = {
    'project': ['wp'],
    'wp': ['subwp'],
    'subwp': ['item']
  };
  return validDrops[dropType]?.includes(dragType);
}

// Function to update the backend/database with the new drop relationships
function updateDatabase(targetType, draggedType, targetId, draggedId) {
  fetch('/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_type: draggedType,
      source_id: draggedId,
      target_type: targetType,
      target_id: targetId
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Database updated successfully');
    } else {
      console.error('Failed to update the database');
    }
  })
  .catch(error => console.error('Error:', error));
}

// Resize the parent window to fit its content
function resizeParentWindow(draggedElement) {
  const parent = draggedElement.closest('.draggable');
  if (parent) {
    const dropZone = parent.querySelector('.drop-zone');
    if (dropZone) {
      parent.style.height = `${dropZone.scrollHeight + 50}px`; // Adjust height as needed
    }
  }
}
