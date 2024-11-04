from flask import Flask, render_template, request, jsonify
import sqlite3
import requests
from datetime import datetime
import os

app = Flask(__name__)

# 配置
APP_TOKEN = 'AT_ZXScrot8L7oTxddaGIZ5KobLXiixJzVT'
DEFAULT_PLATE = '苏CW2N00'

# 数据库初始化
def init_db():
    conn = sqlite3.connect('parking.db')
    c = conn.cursor()
    # 创建管理员表
    c.execute('''CREATE TABLE IF NOT EXISTS admin
                 (id INTEGER PRIMARY KEY, uid TEXT UNIQUE, created_at TIMESTAMP)''')
    # 创建用户表，添加 plate_number 字段
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY, 
                  uid TEXT UNIQUE, 
                  plate_number TEXT,
                  created_at TIMESTAMP)''')
    # 创建提交记录表
    c.execute('''CREATE TABLE IF NOT EXISTS submissions
                 (id INTEGER PRIMARY KEY, 
                  plate_number TEXT,
                  user_uid TEXT,
                  status TEXT,
                  created_at TIMESTAMP)''')
    conn.commit()
    conn.close()

# 路由：主页
@app.route('/')
def index():
    return render_template('index.html', plate_number=DEFAULT_PLATE)

# 路由：管理员设置
@app.route('/admin')
def admin():
    return render_template('admin.html')

# API：获取二维码
@app.route('/api/qrcode', methods=['GET'])
def get_qrcode():
    try:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15'
        }
        response = requests.post(
            'https://wxpusher.zjiecode.com/api/fun/create/qrcode',
            json={
                'appToken': APP_TOKEN,
                'extra': 'admin'
            },
            headers=headers
        )
        return jsonify(response.json())
    except Exception as e:
        print('Error:', str(e))  # 添加错误日志
        return jsonify({'success': False, 'message': str(e)}), 500

# API：检查扫码状态
@app.route('/api/admin', methods=['GET'])
def check_admin():
    try:
        code = request.args.get('code')
        print(f"收到扫码状态检查请求，code: {code}")
        
        if not code:
            return jsonify({'success': False, 'message': '无效的维码'}), 400

        headers = {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15'
        }
        
        response = requests.get(
            f'https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid?code={code}',
            headers=headers
        )
        
        print(f"原始响应: {response.text}")
        data = response.json()
        print(f"WxPusher 返回数据: {data}")
        
        # 修改判断逻辑
        if data.get('code') == 1000:  # 成功的状态码
            uid = data.get('data')  # 直接获取 UID
            if uid:  # 如果有 UID
                print(f"准备保存管理员 UID: {uid}")
                
                conn = sqlite3.connect('parking.db')
                c = conn.cursor()
                c.execute('INSERT OR REPLACE INTO admin (uid, created_at) VALUES (?, ?)',
                         (uid, datetime.now()))
                conn.commit()
                conn.close()
                
                print(f"管理员 UID 已保存: {uid}")
                return jsonify({'success': True})
        
        # 如果还没扫码或其他情况
        return jsonify({
            'success': False,
            'message': '等待扫码...',
            'raw_response': data
        })
    except Exception as e:
        print(f'Error in check_admin: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500

# API：提交缴费
@app.route('/api/submit', methods=['POST'])
def submit():
    try:
        data = request.json
        plate_number = data.get('plateNumber', DEFAULT_PLATE)
        user_uid = data.get('userUID')

        if not user_uid:
            return jsonify({'success': False, 'message': '请先扫码关注'}), 400

        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        try:
            # 获取管理员UID
            c.execute('SELECT uid FROM admin LIMIT 1')
            result = c.fetchone()
            
            if not result or not result[0]:
                return jsonify({'success': False, 'message': '未设置管理员'}), 400
            
            admin_uid = result[0]

            # 记录提交
            c.execute('''INSERT INTO submissions 
                        (plate_number, user_uid, status, created_at) 
                        VALUES (?, ?, ?, ?)''',
                     (plate_number, user_uid, 'submitted', datetime.now()))
            conn.commit()

            # 发送微信通知给管理员
            response = requests.post(
                'https://wxpusher.zjiecode.com/api/send/message',
                json={
                    'appToken': APP_TOKEN,
                    'content': f'有新的停车缴费申请\n车牌号：{plate_number}',
                    'summary': f'新的缴费申请：{plate_number}',
                    'contentType': 1,
                    'uids': [admin_uid]
                }
            )

            if not response.json().get('success'):
                raise Exception('发送通知失败')

            return jsonify({'success': True})
        finally:
            conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# 添加到其他路由之后
@app.route('/success')
def success():
    return render_template('success.html')

# 添加管理员状态检查接口
@app.route('/api/admin/status', methods=['GET'])
def admin_status():
    try:
        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('SELECT uid, created_at FROM admin LIMIT 1')
        result = c.fetchone()
        conn.close()
        
        if result:
            return jsonify({
                'success': True,
                'data': {
                    'uid': result[0],
                    'created_at': result[1]
                }
            })
        return jsonify({
            'success': False,
            'message': '未设置管理员'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 修改调试路由
@app.route('/debug/admin')
def debug_admin():
    print("开始访问 debug/admin 路由")  # 添加日志
    try:
        conn = None
        try:
            # 检查数据库文件是否存在
            db_path = 'parking.db'
            if not os.path.exists(db_path):
                print(f"数据库文件不存在: {db_path}")  # 添加日志
                return jsonify({
                    'success': False,
                    'message': '数据库文件不存在'
                })

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            
            # 检查表是否存在
            c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='admin'")
            if not c.fetchone():
                print("admin 表不存在")  # 添加日志
                return jsonify({
                    'success': False,
                    'message': 'admin 表不存在'
                })

            c.execute('SELECT * FROM admin')
            result = c.fetchall()
            print(f"查询结果: {result}")  # 添加日志
            
            return jsonify({
                'success': True,
                'admin_count': len(result),
                'admins': result
            })
        except sqlite3.Error as sql_error:
            print(f"数据库错误: {str(sql_error)}")  # 添加日志
            return jsonify({
                'success': False,
                'message': f'数据库错误: {str(sql_error)}'
            })
    except Exception as e:
        print(f"其他错误: {str(e)}")  # 添加日志
        return jsonify({
            'success': False,
            'message': str(e)
        })
    finally:
        if conn:
            conn.close()
            print("数据库连接已关闭")  # 添加日志

def reset_db():
    """重置数据库"""
    if os.path.exists('parking.db'):
        os.remove('parking.db')
    init_db()
    print("数据库已重置")

# 添加重置管理员接口
@app.route('/api/admin/reset', methods=['POST'])
def reset_admin():
    try:
        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('DELETE FROM admin')
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 添加用户二维码生成接口
@app.route('/api/qrcode/user', methods=['GET'])
def get_user_qrcode():
    try:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15'
        }
        response = requests.post(
            'https://wxpusher.zjiecode.com/api/fun/create/qrcode',
            json={
                'appToken': APP_TOKEN,
                'extra': 'user'
            },
            headers=headers
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# 修改用户状态检查接口
@app.route('/api/user/check', methods=['GET'])
def check_user():
    try:
        code = request.args.get('code')
        print(f"收到用户扫码状态检查请求，code: {code}")  # 添加日志
        
        if not code:
            return jsonify({'success': False, 'message': '无的二维码'}), 400

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15'
        }
        
        # 使用正确的 API 地址
        response = requests.get(
            f'https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid?code={code}',
            headers=headers
        )
        
        print(f"WxPusher 原始响应: {response.text}")  # 添加日志
        data = response.json()
        print(f"WxPusher 返回数据: {data}")  # 添加日志
        
        # 检查响应格式
        if data.get('code') == 1000 and data.get('data'):
            uid = data.get('data')
            print(f"获取到用户 UID: {uid}")  # 添加日志
            
            # 保存用户 UID 到数据库
            conn = sqlite3.connect('parking.db')
            c = conn.cursor()
            try:
                c.execute('INSERT OR REPLACE INTO users (uid, created_at) VALUES (?, ?)',
                         (uid, datetime.now()))
                conn.commit()
                print(f"用户 UID 已保存到数据库: {uid}")  # 添加日志
                return jsonify({
                    'success': True,
                    'data': {'uid': uid}
                })
            finally:
                conn.close()
        
        # 如果没有获取到 UID
        return jsonify({
            'success': False,
            'message': '等待扫码...',
            'raw_response': data
        })
    except Exception as e:
        print(f"用户扫码检查错误: {str(e)}")  # 添加错误日志
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 添加获取提交记录接口
@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    try:
        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('''SELECT id, plate_number, user_uid, status, created_at 
                    FROM submissions ORDER BY created_at DESC''')
        submissions = [{
            'id': row[0],
            'plate_number': row[1],
            'user_uid': row[2],
            'status': row[3],
            'created_at': row[4]
        } for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'data': submissions})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# 添加标记为已缴费接口
@app.route('/api/mark-paid', methods=['POST'])
def mark_paid():
    try:
        data = request.json
        submission_id = data.get('submissionId')
        user_uid = data.get('userUID')

        if not submission_id or not user_uid:
            return jsonify({'success': False, 'message': '参数不完整'}), 400

        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        try:
            # 更新状态
            c.execute('UPDATE submissions SET status = ? WHERE id = ?',
                     ('paid', submission_id))
            conn.commit()

            # 发送通知给用户
            response = requests.post(
                'https://wxpusher.zjiecode.com/api/send/message',
                json={
                    'appToken': APP_TOKEN,
                    'content': '您的停车缴费已处理完���',
                    'summary': '缴费处理完成',
                    'contentType': 1,
                    'uids': [user_uid]
                }
            )

            if not response.json().get('success'):
                raise Exception('发送通知失败')

            return jsonify({'success': True})
        finally:
            conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# 添加管理页面路由
@app.route('/manage')
def manage():
    return render_template('manage.html')

# 修改用户状态检查接口
@app.route('/api/user/status', methods=['GET'])
def user_status():
    try:
        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('SELECT uid, plate_number, created_at FROM users LIMIT 1')
        result = c.fetchone()
        conn.close()
        
        if result:
            return jsonify({
                'success': True,
                'data': {
                    'uid': result[0],
                    'plate_number': result[1] or DEFAULT_PLATE,
                    'created_at': result[2]
                }
            })
        return jsonify({
            'success': False,
            'message': '未设置用户'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 添加用户重置接口
@app.route('/api/user/reset', methods=['POST'])
def reset_user():
    try:
        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('DELETE FROM users')
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 添加更新车牌号接口
@app.route('/api/user/plate', methods=['POST'])
def update_plate():
    try:
        data = request.json
        plate_number = data.get('plateNumber')
        user_uid = data.get('userUID')

        if not plate_number or not user_uid:
            return jsonify({'success': False, 'message': '参数不完整'}), 400

        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        c.execute('UPDATE users SET plate_number = ? WHERE uid = ?',
                 (plate_number, user_uid))
        conn.commit()
        conn.close()

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# 添加历史页面路由
@app.route('/history')
def history():
    return render_template('history.html')

# 添加关于页面路由
@app.route('/about')
def about():
    return render_template('about.html')

# 添加用户历史记录接口
@app.route('/api/user/history')
def get_user_history():
    try:
        user_uid = request.args.get('uid')
        if not user_uid:
            return jsonify({'success': False, 'message': '未提供用户ID'}), 400

        conn = sqlite3.connect('parking.db')
        c = conn.cursor()
        
        # 获取用户的所有提交记录
        c.execute('''
            SELECT s.id, s.plate_number, s.status, s.created_at,
                   (SELECT created_at FROM submissions s2 
                    WHERE s2.id = s.id AND s2.status = 'paid') as paid_at
            FROM submissions s
            WHERE s.user_uid = ?
            ORDER BY s.created_at DESC
        ''', (user_uid,))
        
        records = [{
            'id': row[0],
            'plate_number': row[1],
            'status': row[2],
            'created_at': row[3],
            'paid_at': row[4]
        } for row in c.fetchall()]
        
        conn.close()
        return jsonify({'success': True, 'data': records})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    reset_db()
    app.run(debug=True, host='127.0.0.1', port=5000)