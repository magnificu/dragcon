// === main.js content ===

// Drag functionality for modals
let drag = false;
let offsetX, offsetY;
let dragTarget = null;
let selectedRecordId = null;
let editingExisting = false;

// Draggable modals
$(document).on("mousedown", ".window-header", function (e) {
    drag = true;
    dragTarget = $(this).closest(".draggable");
    offsetX = e.clientX - dragTarget.offset().left;
    offsetY = e.clientY - dragTarget.offset().top;
});

$(document).on("mouseup", () => drag = false);

$(document).on("mousemove", function (e) {
    if (drag && dragTarget) {
        const left = e.clientX - offsetX;
        const top = e.clientY - offsetY;
        const maxX = $(window).width() - dragTarget.outerWidth();
        const maxY = $(window).height() - dragTarget.outerHeight();

        dragTarget.css({
            left: Math.max(0, Math.min(maxX, left)),
            top: Math.max(0, Math.min(maxY, top)),
        });
    }
});

// Modal open/close
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Trigger file input when image is clicked
$("#image-button").on("click", function () {
    $("#edit-image").click();
});

// When a new image is selected, update preview
$("#edit-image").on("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            $("#image-button").attr("src", event.target.result);
        };
        reader.readAsDataURL(file);
    }
});


// CRUD operations
function reloadRecords() {
    const lastSelectedId = selectedRecordId;
    $("#items-container").load("/tb_item", function () {
        if (lastSelectedId) {
            const selected = $(`.item-box[data-id='${lastSelectedId}']`);
            selected.addClass('selected');
            selectedRecordId = lastSelectedId;
        } else {
            selectedRecordId = null;
        }
    });
}

function createRecord() {
    editingExisting = false;
    $("#edit-modal-title").text("New Record");
    $("#edit-name").val("New Record");
    $("#edit-image").val("");
    $("#image-preview").empty();
    openModal("edit-modal");
}

function editRecord() {
    if (!selectedRecordId) {
        alert("Please select a record first.");
        return;
    }

    const selected = $(`.item-box[data-id='${selectedRecordId}']`);
    const currentName = selected.attr("data-name");
    const currentImage = selected.attr("data-image");

    editingExisting = true;
    $("#edit-modal-title").text("Edit Record");
    $("#edit-name").val(currentName);
    $("#edit-image").val("");
    //$("#image-preview").html(`<img src="${currentImage}" alt="Current Image" width="100">`);
    $("#image-button").attr("src", currentImage);


    // Load property JSON
    $.get(`/item/${selectedRecordId}/property`, function (response) {
        if (response.success) {
            $("#edit-property").val(response.item.property); // raw JSON string
        } else {
            $("#edit-property").val("");
        }
        openModal("edit-modal");
    });
}

function propertyRecord() {
    if (!selectedRecordId) {
        alert("Please select a record first.");
        return;
    }

    $.get(`/item/${selectedRecordId}/property`, function(response) {
        if (response.success) {
            const { name, property } = response.item; // Destructure name and properties from response
            const properties = JSON.parse(property); // Parse properties if it's stored as a JSON string

            // Set the modal title with item name (header)
            let modalTitle = `${name} Properties`;  // Format title as "itemName Properties"
            $("#property-modal-title").text(modalTitle);

            // Build properties HTML to display in the modal body
            let html = ''; // Start with empty HTML

            // Display properties in the modal body (without repeating the name)
            for (const key in properties) {
                html += `<p><strong>${key}:</strong> ${properties[key]}</p>`;  // For each property
            }

            // Add the properties content to the modal body
            $("#property-body").html(html);

            // Open the modal
            openModal("property-modal");
        } else {
            alert("No properties found for this item.");
        }
    });
}

function saveEdit() {
    const name = $("#edit-name").val().trim();
    const imageFile = $("#edit-image")[0].files[0];
    const property = $("#edit-property").val().trim();

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    // JSON validation !!!
    if (property) {
        try {
            JSON.parse(property);
        } catch (err) {
            alert("Invalid JSON in Properties field.");
            return;
        }
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("property", property);

    if (imageFile) {
        formData.append("image", imageFile);
    }

    const url = editingExisting ? "/edit" : "/create";
    if (editingExisting) {
        formData.append("id", selectedRecordId);
    }

    $.ajax({
        url: url,
        type: "POST",
        data: formData,
        contentType: false,
        processData: false,
        success: function () {
            reloadRecords();
            closeModal("edit-modal");
        },
        error: function () {
            alert("Error saving record.");
        }
    });
}

function deleteRecord() {
    if (!selectedRecordId) {
        alert("Please select a record first.");
        return;
    }
    openModal("delete-modal");
}

function confirmDelete() {
    $.post("/delete", { id: selectedRecordId }, () => {
        reloadRecords();
        closeModal("delete-modal");
        selectedRecordId = null;
    });
}

// Handle selection and unselection
$(document).on('click', function (e) {
    const $target = $(e.target);

    if ($target.closest('.item-box').length) {
        $('.item-box').removeClass('selected');
        const $box = $target.closest('.item-box');
        $box.addClass('selected');
        selectedRecordId = $box.data('id');
    } else if (
        //!$target.closest('.window-footer').length &&
        !$target.closest('.modal-window').length &&
        !$target.hasClass('btn') &&
        !$target.hasClass('btn-close')
    ) {
        $('.item-box').removeClass('selected');
        selectedRecordId = null;
    }
});

// Initial positioning
$(document).ready(function () {
    $(".draggable").each(function (index) {
        const initialLeft = 100 + index * 40;
        const initialTop = 100 + index * 40;
        $(this).css({ left: initialLeft + "px", top: initialTop + "px" });
    });
});


// === dragdrop.js content merged ===

// Allow elements to be dropped
function allowDrop(event) {
    event.preventDefault();
}

// Start dragging
function dragStart(event, type) {
    event.dataTransfer.setData("type", type);
    event.dataTransfer.setData("id", event.target.dataset.id);
}

// Handle drop event
function handleDrop(event, targetType) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("id");
    const draggedType = event.dataTransfer.getData("type");
    const targetId = event.target.dataset.target;

    if (isValidDrop(targetType, draggedType)) {
        const draggedElement = document.querySelector(`[data-id="${draggedId}"]`);
        event.target.appendChild(draggedElement);
        updateDatabase(targetType, draggedType, targetId, draggedId);
        resizeParentWindow(draggedElement);
    }
}

// Validate drop
function isValidDrop(dropType, dragType) {
    const validDrops = {
        'project': ['wp'],
        'wp': ['subwp'],
        'subwp': ['item']
    };
    return validDrops[dropType]?.includes(dragType);
}

// Update DB
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
            console.log('Database updated');
        } else {
            console.error('Database update failed');
        }
    })
    .catch(error => console.error('Error:', error));
}

// Resize parent container
function resizeParentWindow(draggedElement) {
    const parent = draggedElement.closest('.draggable');
    if (parent) {
        const dropZone = parent.querySelector('.drop-zone');
        if (dropZone) {
            parent.style.height = `${dropZone.scrollHeight + 50}px`;
        }
    }
}