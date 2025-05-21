import os
from flask import Flask, render_template, request, jsonify
import json
import sqlite3
from werkzeug.utils import secure_filename

app = Flask(__name__, static_url_path='/static')

# Configure the upload folder and allowed extensions for images
app.config['UPLOADED_IMAGES_DEST'] = 'static/images'
app.config['ALLOWED_EXTENSIONS'] = {'png'}
app.config['DEFAULT_IMAGE'] = '/static/images/question.png'  # Default image path

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Helper function to check if the file has an allowed extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    conn = get_db_connection()
    # Fetch Projects, WPs, subWPs, and Items
    projects = conn.execute('SELECT * FROM tb_Project').fetchall()
    wps = conn.execute('SELECT * FROM tb_WP').fetchall()
    subwps = conn.execute('SELECT * FROM tb_subWP').fetchall()
    items = conn.execute('SELECT * FROM tb_item').fetchall()
    conn.close()
    return render_template('index.html', projects=projects, wps=wps, subwps=subwps, items=items)

@app.route('/viewer')
def viewer():
    return render_template('viewer.html')  # or index.html if reused

@app.route('/create', methods=['POST'])
def create_item():
    name = request.form['name']
    properties = request.form.get('property', '{}')  # default to empty JSON

    # ✅ Validate JSON
    try:
        json.loads(properties)
    except json.JSONDecodeError:
        return jsonify(success=False, error="Invalid JSON in properties"), 400

    image_file = request.files.get('image')

    if image_file and allowed_file(image_file.filename):
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOADED_IMAGES_DEST'], filename)
        image_file.save(image_path)
        image_url = f"/static/images/{filename}"
    else:
        image_url = app.config['DEFAULT_IMAGE']

    conn = get_db_connection()
    conn.execute(
        'INSERT INTO tb_item (name, image_url, property) VALUES (?, ?, ?)',
        (name, image_url, properties)
    )
    conn.commit()
    conn.close()

    return jsonify(success=True)

@app.route('/edit', methods=['POST'])
def edit_item():
    record_id = request.form['id']
    name = request.form['name']
    properties = request.form.get('property', '{}')  # Get JSON string from form
    image_file = request.files.get('image')

    conn = get_db_connection()

    if image_file and allowed_file(image_file.filename):
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOADED_IMAGES_DEST'], filename)
        image_file.save(image_path)
        image_url = f"/static/images/{filename}"
    else:
        # Keep existing image if not uploading new one
        existing = conn.execute('SELECT image_url FROM tb_item WHERE id = ?', (record_id,)).fetchone()
        image_url = existing['image_url'] if existing else app.config['DEFAULT_IMAGE']

    conn.execute(
        'UPDATE tb_item SET name = ?, image_url = ?, property = ? WHERE id = ?',
        (name, image_url, properties, record_id)
    )
    conn.commit()
    conn.close()

    return jsonify(success=True)

@app.route('/item/<int:item_id>/property')
def get_item_property(item_id):
    conn = get_db_connection()
    item = conn.execute('SELECT name, property FROM tb_item WHERE id = ?', (item_id,)).fetchone()
    conn.close()
    if item and item['property']:
        return jsonify(success=True, item={
            'name': item['name'],
            'property': item['property']
        })
    return jsonify(success=False, error="No property found.")

@app.route('/delete', methods=['POST'])
def delete_item():
    record_id = request.form['id']
    conn = get_db_connection()
    conn.execute('DELETE FROM tb_item WHERE id = ?', (record_id,))
    conn.commit()
    conn.close()
    return jsonify(success=True)

@app.route('/tb_item')
def get_items():
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM tb_item').fetchall()
    conn.close()
    return render_template('items.html', items=records)

# Route to handle the drag-and-drop action of items between containers
@app.route('/move', methods=['POST'])
def move():
    data = request.get_json()
    source_type = data['source_type']
    source_id = data['source_id']
    target_type = data['target_type']
    target_id = data['target_id']

    # Update the database with the new relationship
    if source_type == 'wp' and target_type == 'project':
        # Update the rel_Project_WP table
        pass
    elif source_type == 'subwp' and target_type == 'wp':
        # Update the rel_WP_subWP table
        pass
    elif source_type == 'item' and target_type == 'subwp':
        # Update the rel_subWP_item table
        pass

    return jsonify({'success': True})


if __name__ == '__main__':
    # Ensure the upload folder exists
    if not os.path.exists(app.config['UPLOADED_IMAGES_DEST']):
        os.makedirs(app.config['UPLOADED_IMAGES_DEST'])

    # Ensure the default image exists in the static folder
    if not os.path.exists(os.path.join(app.config['UPLOADED_IMAGES_DEST'], 'question.png')):
        # Optionally, you could copy a default question.png file to this location or serve a placeholder image
        pass

    app.run(debug=True)
