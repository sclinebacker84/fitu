const params = new URLSearchParams(window.location.search)
if(params.get('token') && params.get('email')){
	window.localStorage.setItem('token', params.get('token'))
	window.localStorage.setItem('email', params.get('email'))
	history.pushState({},undefined,window.location.href.replace(window.location.search,''))
}

const IdentityPoolId = 'us-east-1:fc77f43d-2fe4-4855-9626-fc98cd765fe7'
AWS.config.region = 'us-east-1'
AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId})

const {h,render,Component} = window.preact

const lambda = new AWS.Lambda()
const dynamodb = new AWS.DynamoDB.DocumentClient({convertEmptyValues:true})

const request = (url,body,method) => {
	return fetch(url, {
		method:method || (body ? 'POST' : 'GET'),
		body:JSON.stringify(body),
		headers:{
			'Content-Type':'application/json'
		}
	})
}

/**********************************************/

class Profile extends Component {
	constructor(props){
		super(props)
		this.state.form = this.props.form
		this.state.certs = {}
		this.certs()
	}
	async certs(){
		const r = await dynamodb.get({
			TableName:'configs',
			Key:{
				partitionKey:'fitu_certs'
			}
		}).promise()
		const certs = {}
		r.Item.data.forEach(r => {
			certs[r.certification] = certs[r.certification] || []
			certs[r.certification].push(r.institute)
		})
		this.setState({certs})
	}
	async save(){
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_save_professional',
			Payload:JSON.stringify(Object.assign(this.state.form, {
				token:window.localStorage.getItem('token')
			}))
		}).promise()
		this.setState({loading:false})
	}
	addCertification(){
		this.state.form.certifications.unshift({})
		this.setState(this.state)
	}
	removeCertification(){
		this.state.form.certifications.shift()
		this.setState(this.state)
	}
	updateValue(o,k,v){
		o[k] = v
		this.setState(this.state)
	}
	render(){
		return h('div',undefined,
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'First Name'),
				h('input',{
					required:true,
					class:'form-input',
					value:this.state.form.name.first,
					onInput:e => this.updateValue(this.state.form.name,'first',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Middle Name'),
				h('input',{
					class:'form-input',
					value:this.state.form.name.middle,
					onInput:e => this.updateValue(this.state.form.name,'middle',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Last Name'),
				h('input',{
					class:'form-input',
					value:this.state.form.name.last,
					onInput:e => this.updateValue(this.state.form.name,'last',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Phone Number'),
				h('input',{
					class:'form-input',
					type:'tel',
					value:this.state.form.phone,
					onInput:e => this.updateValue(this.state.form,'phone',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Zip Code'),
				h('input',{
					class:'form-input',
					type:'number',
					value:this.state.form.zip,
					onInput:e => this.updateValue(this.state.form,'zip',e.target.value)
				})
			),
			h('div',{class:'form-group'},
				h('label',{class:'form-label'},'Gender'),
				h('select',{
					class:'form-select',
					value:this.state.form.gender,
					onInput:e => this.updateValue(this.state.form,'gender',e.target.value)
				},
					h('option',{value:'Male'},'Male'),
					h('option',{value:'Female'},'Female')
				)
			),
			h('div',{class:'divider text-center','data-content':'Certifications'}),
			h('div',{class:'container'},
				h('button',{class:'btn',onClick:e => this.addCertification()},'Add'),
				h('button',{class:'btn float-right',onClick:e => this.removeCertification()},'Remove')
			),
			this.state.form.certifications.map((cert,index) => 
				h('div',{class:'columns'},
					h('div',{class:'column col-12 columns'},
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Certification'),
							h('select',{
								class:'form-select',
								value:cert.name,
								onInput:e => this.updateValue(cert,'name',e.target.value)
							},
							Object.keys(this.state.certs).map(c => 
								h('option',{value:c},c)
							))
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Expires On'),
							h('input',{
								class:'form-input',
								type:'date',
								value:cert.expirationDate,
								min:new Date().toISOString().split('T')[0],
								onInput:e => this.updateValue(cert,'expirationDate',e.target.value)
							})
						),
						h('div',{class:'column col-4'},
							h('label',{class:'form-label'},'Institute'),
							h('select',{
								class:'form-select',
								value:cert.institute,
								onInput:e => this.updateValue(cert,'institute',e.target.value)
							},
							this.state.certs[cert.name] && this.state.certs[cert.name].map(c => 
								h('option',{value:c},c)
							))
						)
					)
				)
			),
			h('div',{class:'text-center mt-2'},
				h('button',{class:`btn btn-success ${this.state.loading ? 'loading' : ''}`,onClick:e => this.save()},'Save')
			)
		)
	}
}

class Schedule extends Component {
	constructor(props){
		super(props)
		this.state.schedule = this.props.schedule
		this.state.days = ['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays']
		this.state.times = [
			{
				name:'Morning',
				label:'Morning (6am to 12pm)'
			},
			{
				name:'Midday',
				label:'Midday (12pm to 5pm)'
			},
			{
				name:'Evening',
				label:'Evening (5pm to 9pm)'	
			}
		]
		this.state.days.forEach(d => this.state.schedule[d] = this.state.schedule[d] || {})
	}
	toggle(d,t,e){
		this.state.schedule[d][t.name] = e.target.checked
		this.setState(this.state)
	}
	async save(){
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'fitu_schedule',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				schedule:this.state.schedule
			})
		}).promise()
		this.setState({loading:false})
	}
	render(){
		return h('div',undefined,
			h('div',{style:'height: 30em ; overflow-y: auto'},
				this.state.days.map(d => h('div',undefined,
					h('div',{class:'text-center h5'},d),
					h('div',{class:'columns'},
						this.state.times.map(t => h('div',{class:'column col-4 col-xs-12 text-center'},
							h('label',{class:"form-checkbox d-inline-flex"},
						    	h('input',{class:'form-input',type:'checkbox',checked:this.state.schedule[d][t.name],onInput:e => this.toggle(d,t,e)}),
						    	h('i',{class:"form-icon"}),
						    	t.label
						    )
						))
					)
				))
			),
			h('div',{class:'text-center'},
				h('button',{class:'btn btn-success'+(this.state.loading ? ' loading' : ''),onClick:e => this.save()},'Save')
			)
		)
	}
}

class Auth extends Component {
	async auth(e){
		e.preventDefault()
		this.setState({loading:true})
		await lambda.invoke({
			FunctionName:'auth',
			Payload:JSON.stringify({email:this.state.email,url:window.location.href,name:'FitU'})
		}).promise()
		this.setState({loading:false})
		alert('Done!')
	}
	render(){
		return h('div',undefined,
			h('form',{class:'form-group text-center',onSubmit:e => this.auth(e)},
				h('label',{class:'form-label'},'Enter Email'),
				h('input',{class:'form-input text-center',onInput:e => this.setState({email:e.target.value})}),
				h('button',{class:`btn mt-1 ${this.state.loading ? 'loading' : ''}`},'Submit')
			)
		)
	}
}

class Container extends Component {
	constructor(props){
		super(props)
		this.state.screens = [
			{
				name:'Profile',
				icon:'icon-people'
			},
			{
				name:'Schedule',
				icon:'icon-time'
			}
		]
		this.state.screen = this.state.screens[0]
		this.state.form = {certifications:[],name:{},schedule:{}}
		this.profile()
	}
	async profile(){
		const r = await lambda.invoke({
			FunctionName:'fitu_get_profile',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({form:Object.assign(this.state.form, JSON.parse(r.Payload))})
	}
	hasAuth(){
		return window.localStorage.getItem('email') && window.localStorage.getItem('token')
	}
	changeMenu(e,s){
		this.setState({screen:s})
	}
	screen(){
		switch(this.state.screen.name){
			case 'Profile':
				return h(Profile,{form:this.state.form})
			case 'Schedule':
				return h(Schedule,{schedule:this.state.form.schedule})
		}
	}
	content(){
		return h('div',{class:'container'},
			h('div',{class:'navbar bg-secondary mb-2'},
				h('div',{class:'navbar-section'},
					h('a',{class:'off-canvas-toggle btn btn-link', href:'#sidebar'},
						h('i',{class:'icon icon-menu'})
					)
				),
				h('div',{class:'navbar-center'},
					h('img',{class:'img-responsive',style:'height: 3em',src:'../img/logo.png'})
				),
				h('div',{class:'navbar-section'})
			),
			h('div',{class:'off-canvas'},
				h('div',{class:'off-canvas-content',style:'padding: 0px'},
					this.screen()
				),
				h('div',{class:'off-canvas-sidebar',id:'sidebar'},
					h('div',{class:'container'},
						h('ul',{class:'menu'},
							this.state.screens.map(s => h('li',{class:'menu-item'},
								h('a',{href:'#close',onClick:e => this.changeMenu(e,s)},
									h('i',{class:'icon mr-2 '+s.icon}),
									h('label',{class:'form-label d-inline-flex'+(this.state.screen === s ? ' text-bold' : '')},s.name)
								)
							))
						)
					)
				),
				h('a',{href:'#close',class:'off-canvas-overlay'})
			)
		)
	}
	render(){
		return this.hasAuth() ? this.content() : h(Auth)
	}
}

document.addEventListener('DOMContentLoaded', () => render(h(Container), document.body))