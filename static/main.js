// Drag functionality
let drag = false;
let offsetX, offsetY;
let dragTarget = null;
let selectedRecordId = null;
let editingExisting = false;

// Draggable functionality for modals
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

// Modal Open/Close Helpers
function openModal(id) {
    $("#" + id).show();
}

function closeModal(id) {
    $("#" + id).hide();
}

// Preview image before saving
$("#edit-image").on("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            $("#image-preview").html(`<img src="${event.target.result}" alt="Image preview" width="100">`);
        };
        reader.readAsDataURL(file);
    } else {
        $("#image-preview").empty();
    }
});

// CRUD operations
function reloadRecords() {
    const lastSelectedId = selectedRecordId;

    $("#records-container").load("/records", function () {
        if (lastSelectedId) {
            const selected = $(`.record-box[data-id='${lastSelectedId}']`);
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

    const selected = $(`.record-box[data-id='${selectedRecordId}']`);
    const currentName = selected.attr("data-name");
    const currentImage = selected.attr("data-image");

    editingExisting = true;
    $("#edit-modal-title").text("Edit Record");
    $("#edit-name").val(currentName);
    $("#edit-image").val("");
    $("#image-preview").html(`<img src="${currentImage}" alt="Current Image" width="100">`);
    openModal("edit-modal");
}

function saveEdit() {
    const name = $("#edit-name").val().trim();
    const imageFile = $("#edit-image")[0].files[0];

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    const formData = new FormData();
    formData.append("name", name);

    if (imageFile) {
        formData.append("image", imageFile);
    }

    if (editingExisting) {
        formData.append("id", selectedRecordId);
        $.ajax({
            url: "/edit",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function () {
                reloadRecords();
                closeModal("edit-modal");
            },
            error: function () {
                alert("Error updating record.");
            }
        });
    } else {
        $.ajax({
            url: "/create",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function () {
                reloadRecords();
                closeModal("edit-modal");
            },
            error: function () {
                alert("Error creating record.");
            }
        });
    }
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

// Handle selection and unselection of record boxes
$(document).on('click', function (e) {
    const $target = $(e.target);

    // If clicked inside a record-box
    if ($target.closest('.record-box').length) {
        $('.record-box').removeClass('selected');
        const $box = $target.closest('.record-box');
        $box.addClass('selected');
        selectedRecordId = $box.data('id');
    } 
    // If clicked outside record-box AND not on control buttons
    else if (
        !$target.closest('.window-footer').length &&
        !$target.closest('.modal-window').length &&
        !$target.hasClass('btn') &&
        !$target.hasClass('btn-close')
    ) {
        $('.record-box').removeClass('selected');
        selectedRecordId = null;
    }
});


