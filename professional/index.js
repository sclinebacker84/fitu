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

const buildTimes = () => {
	const times = []
	const hourLogic = (i) => i > 11 ? i === 12 ? '12pm' : `${i-12}pm` : `${i}am`
	for(let i=6 ; i <= 20 ; i++){
		times.push({name:`${i}`, label:`${hourLogic(i)} - ${hourLogic(i+1)}`})
	}
	return times
}

/**********************************************/

class Loading extends Component {
	render(){
		return h('div',undefined,
			h('div',{class:'h4 loading'})
		)
	}
}

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
	async updatePayment(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_update_professional_payment',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token')
			})
		}).promise()
		this.setState({loading:false})
		window.location.replace(JSON.parse(r.Payload))
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
			this.state.form.hasPending && h('div',{class:'toast toast-warning text-center'},'Pending Changes'),
			this.state.form.sortKey && h('div',{class:'text-center'},
				h('button',{class:`btn mt-1 ${this.state.loading ? 'loading' : ''}`,onClick:e => this.updatePayment()},'Update Payment')
			),
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
			h('div',{class:'divider text-center','data-content':'Link your Social Media'}),
			h('div',{class:'form-group columns'},
				h('div',{class:'column col-10'},
					h('input',{
						class:'form-input',
						type:'link',
						placeholder:'Instagram handle',
						value:this.state.form.instagram,
						onInput:e => this.updateValue(this.state.form,'instagram',e.target.value)
					})
				),
				h('div',{class:'column col-2'},
					h('img',{class:'img-responsive',style:'height: 2em',src:'../img/instagram.jpg'})
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
		this.state.times = buildTimes()
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

class Requests extends Component {
	constructor(props){
		super(props)
		this.state.requests = []
		this.getRequests()
	}
	getNextMoment = (day,time) => {
		day = day.substring(0,day.length - 1)
		var weekDayToFind = moment().day(day).weekday(); //change to searched day name
		var searchDate = moment(); //now or change to any date
		while (searchDate.weekday() !== weekDayToFind){ 
		  searchDate.add(1, 'day'); 
		}
		return searchDate.set('hour', parseInt(time)).set('minute', 0).set('second', 0)
	}
	async getRequests(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_requests',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token')
			})
		}).promise()
		const requests = JSON.parse(r.Payload)
		requests.forEach(request => {
			const schedule = []
			Object.keys(request.schedule).forEach(d => {
				Object.keys(request.schedule[d]).forEach(t => {
					const m = this.getNextMoment(d,t)
					schedule.push({day:d,time:t,label:m.toString()})
				})
			})
			request.schedule = schedule
		})
		this.setState({loading:false, requests:requests})
	}
	toggle(request,s,k){
		request.s = s
		request.k = k
		this.setState(this.state)
	}
	async respond(request, approved){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_respond',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				approved:approved,
				request:request
			})
		}).promise()
		this.setState({loading:false})
		await this.getRequests()
	}
	content(){
		return h('div',undefined,
			!this.state.requests.length ? 
			  h('div',{class:'empty'},
			  	h('div',{class:'empty-title h5'},'No Pending Requests')
			  )
			:
			this.state.requests.map((request,i) => h('div',{class:'card text-center'},
				h('div',{class:'card-header'},
					h('div',{class:'card-title h6'},request.sortKey)
				),
				h('div',{class:'card-body'},
					h('ul',{class:'menu'},
						request.schedule.map((s,k) => h('li',{class:'menu-item'},
							h('label',{class:"form-radio d-inline-flex"},
						    	h('input',{class:'form-input',name:`r-${i}`,value:request.k,type:'radio',onInput:e => this.toggle(request,s,k)}),
						    	h('i',{class:"form-icon"}),
						    	`${s.label}`
						    )
						))
					)
				),
				h('div',{class:'card-footer'},
					!!request.s && h('div',{class:'btn-group'},
						h('button',{class:'btn btn-success',onClick:e => this.respond(request,true)},'Accept'),
						h('button',{class:'btn',onClick:e => this.respond(request,false)},'Decline')
					)
				)
			))
		)
	}
	render(){
		return this.state.loading ? h('div',{class:'loading'}) : this.content()
	}
}

class Appointments extends Component {
	constructor(props){
		super(props)
		this.state.appointments = []
		this.getAppointments()
	}
	async getAppointments(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_appointments',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				type:'Professional'
			})
		}).promise()
		const appointments = JSON.parse(r.Payload)
		this.setState({loading:false, appointments:appointments})
	}
	async start(appointment){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_appointment_action',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				sortKey:appointment.sortKey,
				type:'Professional',
				cancel:false
			})
		}).promise()
		this.setState({loading:false})
		await this.getAppointments()
	}
	async cancel(appointment){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_appointment_action',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				sortKey:appointment.sortKey,
				type:'Professional',
				cancel:true
			})
		}).promise()
		this.setState({loading:false})
		await this.getAppointments()
	}
	content(){
		return h('div',undefined,
			!this.state.appointments.length ? 
			  h('div',{class:'empty'},
			  	h('div',{class:'empty-title h5'},'No Pending Appointments')
			  )
			:
			this.state.appointments.map((request,i) => h('div',{class:'card text-center'},
				h('div',{class:'card-header'},
					h('div',{class:'card-title h6'},request.sortKey)
				),
				h('div',{class:'card-body'},
					h('div',{class:'text-center'},request.date)
				),
				h('div',{class:'card-footer'},
					h('div',{class:'btn-group'},
						h('button',{class:'btn btn-success',onClick:e => this.start(request)},'Start'),
						h('button',{class:'btn',onClick:e => this.cancel(request)},'Cancel')
					)
				)
			))
		)
	}
	render(){
		return this.state.loading ? h('div',{class:'loading'}) : this.content()
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

class Rates extends Component {
	constructor(props){
		super(props)
		this.rates()
	}
	async rates(){
		this.setState({loading:true})
		const r = await lambda.invoke({
			FunctionName:'fitu_get_rates',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token')
			})
		}).promise()
		const rates = JSON.parse(r.Payload)
		this.setState({loading:false, rates:rates})
	}
	content(){
		return h('table',{class:'table table-striped'},
			h('thead',undefined,
				h('tr',undefined,
					h('th',undefined,'Profession'),
					h('th',undefined,'Rate')
				)
			),
			h('tbody',undefined,
				this.state.rates.map(r => h('tr',undefined,
					h('td',undefined,r.profession),
					h('td',undefined,r.rate)	
				))
			)
		)
	}
	render(){
		return this.state.loading ? h(Loading) : this.content()
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
			},
			{
				name:'Requests',
				icon:'icon-flag'
			},
			{
				name:'Appointments',
				icon:'icon-mail'
			},
			{
				name:'Rates',
				icon:'icon-bookmark'
			}
		]
		this.state.screen = this.state.screens[0]
		this.state.form = {certifications:[],name:{},schedule:{},payment:{}}
		this.profile()
	}
	async profile(){
		const r = await lambda.invoke({
			FunctionName:'fitu_get_profile',
			Payload:JSON.stringify({
				token:window.localStorage.getItem('token'),
				type:'Professional'
			})
		}).promise()
		if(r.Payload){
			this.setState({form:Object.assign(this.state.form, JSON.parse(r.Payload))})
		}
	}
	show(s,i){
		return i === 0 || this.state.form.payment.contractor
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
			case 'Requests':
				return h(Requests,{form:this.state.form})
			case 'Appointments':
				return h(Appointments,{form:this.state.form})
			case 'Schedule':
				return h(Schedule,{schedule:this.state.form.schedule})
			case 'Rates':
				return h(Rates,{})
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
							this.state.screens.filter((s,i) => this.show(s,i)).map(s => h('li',{class:'menu-item'},
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