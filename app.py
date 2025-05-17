import os
from flask import Flask, render_template, request, jsonify
import sqlite3
from werkzeug.utils import secure_filename

app = Flask(__name__)

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
    records = conn.execute('SELECT * FROM records').fetchall()
    conn.close()
    return render_template('index.html', records=records)

@app.route('/create', methods=['POST'])
def create():
    name = request.form['name']
    image_file = request.files.get('image')  # Get image file from the request

    if image_file and allowed_file(image_file.filename):
        # Secure the filename and save the file
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOADED_IMAGES_DEST'], filename)
        image_file.save(image_path)
        image_url = f"/static/images/{filename}"  # URL to be stored in the DB
    else:
        # Use the default image if no file is uploaded
        image_url = app.config['DEFAULT_IMAGE']

    # Store the record in the database
    conn = get_db_connection()
    conn.execute('INSERT INTO records (name, image_url) VALUES (?, ?)', (name, image_url))
    conn.commit()
    conn.close()

    return jsonify(success=True)

@app.route('/edit', methods=['POST'])
def edit():
    record_id = request.form['id']
    name = request.form['name']
    image_file = request.files.get('image')  # Get image file from the request

    conn = get_db_connection()

    if image_file and allowed_file(image_file.filename):
        # If an image is uploaded, save it and update the record
        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOADED_IMAGES_DEST'], filename)
        image_file.save(image_path)
        image_url = f"/static/images/{filename}"
        conn.execute('UPDATE records SET name = ?, image_url = ? WHERE id = ?', (name, image_url, record_id))
    else:
        # If no image is uploaded, use the default image
        image_url = app.config['DEFAULT_IMAGE']
        conn.execute('UPDATE records SET name = ?, image_url = ? WHERE id = ?', (name, image_url, record_id))

    conn.commit()
    conn.close()

    return jsonify(success=True)

@app.route('/delete', methods=['POST'])
def delete():
    record_id = request.form['id']
    conn = get_db_connection()
    conn.execute('DELETE FROM records WHERE id = ?', (record_id,))
    conn.commit()
    conn.close()
    return jsonify(success=True)

@app.route('/records')
def records():
    conn = get_db_connection()
    records = conn.execute('SELECT * FROM records').fetchall()
    conn.close()
    return render_template('records.html', records=records)

if __name__ == '__main__':
    # Ensure the upload folder exists
    if not os.path.exists(app.config['UPLOADED_IMAGES_DEST']):
        os.makedirs(app.config['UPLOADED_IMAGES_DEST'])

    # Ensure the default image exists in the static folder
    if not os.path.exists(os.path.join(app.config['UPLOADED_IMAGES_DEST'], 'question.png')):
        # Optionally, you could copy a default question.png file to this location or serve a placeholder image
        pass

    app.run(debug=True)
