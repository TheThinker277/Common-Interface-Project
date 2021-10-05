import React, { useState } from 'react'
import {
  List,
  ListItem,
  Button,
  TextField,
  ExpansionPanel,
  ExpansionPanelSummary,
  ExpansionPanelDetails,
  Typography,
  Divider,
  Popover,
  Tooltip,
  IconButton
} from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import { makeStyles } from '@material-ui/core/styles'
import { useSelector, useDispatch } from 'react-redux'

import { setResultTitle, setResultGraph, setResultText } from '../../redux/actions/index'
import { Save, GenerateCompList } from './Helper/ToolbarTools'
import SimulationScreen from './SimulationScreen'
import api from '../../utils/Api'

const useStyles = makeStyles((theme) => ({
  toolbar: {
    minHeight: '90px'
  },
  pages: {
    margin: theme.spacing(0, 1)
  },
  propertiesBox: {
    width: '100%'
  },
  simulationOptions: {
    margin: '0px',
    padding: '0px',
    width: '100%'
  },
  heading: {
    fontSize: theme.typography.pxToRem(15),
    fontWeight: theme.typography.fontWeightRegular
  }
}))

export default function SimulationProperties () {
  const netfile = useSelector(state => state.netlistReducer)
  const isSimRes = useSelector(state => state.simulationReducer.isSimRes)
  const dispatch = useDispatch()
  const classes = useStyles()
  const [componentsList, setComponentsList] = useState([])
  const [dcSweepcontrolLine, setDcSweepControlLine] = useState({
    parameter: '',
    sweepType: 'Linear',
    start: '',
    stop: '',
    step: '',
    parameter2: '',
    start2: '',
    stop2: '',
    step2: ''
  })
  const [transientAnalysisControlLine, setTransientAnalysisControlLine] = useState({
    start: '',
    stop: '',
    step: '',
    skipInitial: 'No'
  })

  const [acAnalysisControlLine, setAcAnalysisControlLine] = useState({
    input: 'dec',
    start: '',
    stop: '',
    pointsBydecade: ''
  })

  const [controlBlockParam, setControlBlockParam] = useState('')

  const handleControlBlockParam = (evt) => {
    setControlBlockParam(evt.target.value)
  }

  const onDcSweepTabExpand = () => {
    try {
      setComponentsList(['', ...GenerateCompList()])
    } catch (err) {
      setComponentsList([])
      alert('Circuit not complete. Please Check Connectons.')
    }
  }

  const handleDcSweepControlLine = (evt) => {
    const value = evt.target.value

    setDcSweepControlLine({
      ...dcSweepcontrolLine,
      [evt.target.id]: value
    })
  }

  const handleTransientAnalysisControlLine = (evt) => {
    const value = evt.target.value

    setTransientAnalysisControlLine({
      ...transientAnalysisControlLine,
      [evt.target.id]: value
    })
  }

  const handleAcAnalysisControlLine = (evt) => {
    const value = evt.target.value

    setAcAnalysisControlLine({
      ...acAnalysisControlLine,
      [evt.target.id]: value
    })
  }

  const [simulateOpen, setSimulateOpen] = React.useState(false)
  const handlesimulateOpen = () => {
    setSimulateOpen(true)
  }

  const handleSimulateClose = () => {
    setSimulateOpen(false)
  }

  // Prepare Netlist to file
  const prepareNetlist = (netlist) => {
    const titleA = netfile.title.split(' ')[1]
    const myblob = new Blob([netlist], {
      type: 'text/plain'
    })
    const file = new File([myblob], `${titleA}.xml`, { type: 'text/xml', lastModified: Date.now() })
    // console.log(file)
    sendNetlist(file)
  }

  function sendNetlist (file) {
    netlistConfig(file)
      .then((response) => {
        const res = response.data
        const getUrl = 'simulation/status/'.concat(res.details.task_id)

        simulationResult(getUrl)
      })
      .catch(function (error) {
        console.log(error)
      })
  }

  // Upload the nelist
  function netlistConfig (file) {
    const formData = new FormData()
    formData.append('file', file)
    for (const [key, value] of Object.entries(transientAnalysisControlLine)) {
      formData.append(key, value)
    }
    const config = {
      headers: {
        'content-type': 'multipart/form-data'
      }
    }
    return api.post('simulation/upload', formData, config)
  }

  const [isResult, setIsResult] = useState(false)

  // Get the simulation result with task_Id
  function simulationResult (url) {
    api
      .get(url)
      .then((res) => {
        if (res.data.state === 'PROGRESS' || res.data.state === 'PENDING') {
          setTimeout(simulationResult(url), 1000)
        } else {
          const result = res.data.details
          if (result === null) {
            setIsResult(false)
          } else {
            setIsResult(true)
            const temp = res.data.details.data
            const data = result.data
            // console.log('DATA SIm', data)
            if (res.data.details.graph === 'true') {
              const simResultGraph = { labels: [], x_points: [], y_points: [] }
              // populate the labels
              for (let i = 0; i < data.length; i++) {
                simResultGraph.labels[0] = data[i].labels[0]
                const lab = data[i].labels
                // lab is an array containeing labels names ['time','abc','def']
                simResultGraph.x_points = data[0].x

                // labels
                for (let x = 1; x < lab.length; x++) {
                  if (lab[x].includes('#branch')) {
                    lab[x] = `I (${lab[x].replace('#branch', '')})`
                  }
                  //  uncomment below if you want label like V(r1.1) but it will break the graph showing time as well
                  //  else {
                  // lab[x] = `V (${lab[x]})`

                  // }
                  simResultGraph.labels.push(lab[x])
                }
                // populate y_points
                for (let z = 0; z < data[i].y.length; z++) {
                  simResultGraph.y_points.push(data[i].y[z])
                }
              }

              simResultGraph.x_points = simResultGraph.x_points.map(d => parseFloat(d))

              for (let i1 = 0; i1 < simResultGraph.y_points.length; i1++) {
                simResultGraph.y_points[i1] = simResultGraph.y_points[i1].map(d => parseFloat(d))
              }

              dispatch(setResultGraph(simResultGraph))
            } else {
              const simResultText = []
              for (let i = 0; i < temp.length; i++) {
                let postfixUnit = ''
                if (temp[i][0].includes('#branch')) {
                  temp[i][0] = `I(${temp[i][0].replace('#branch', '')})`
                  postfixUnit = 'A'
                } else {
                  temp[i][0] = `V(${temp[i][0]})`
                  postfixUnit = 'V'
                }

                simResultText.push(temp[i][0] + ' ' + temp[i][1] + ' ' + parseFloat(temp[i][2]) + ' ' + postfixUnit + '\n')
              }

              dispatch(setResultText(simResultText))
            }
          }
        }
      })
      .then((res) => { handlesimulateOpen() })
      .catch(function (error) {
        console.log(error)
      })
  }

  const startSimulate = (type) => {
    const compNetlist = Save()
    switch (type) {
      case 'DcSolver':
        dispatch(setResultTitle('DC Solver Output'))
        break
      case 'DcSweep':
        dispatch(setResultTitle('DC Sweep Output'))
        break
      case 'Transient':
        dispatch(setResultTitle('Transient Analysis Output'))
        break
      case 'Ac':
        dispatch(setResultTitle('AC Analysis Output'))
        break
      default:
        break
    }

    const netlist = compNetlist

    prepareNetlist(netlist)

    // handlesimulateOpen()
  }

  // simulation properties add expression input box
  const [anchorEl, setAnchorEl] = React.useState(null)
  const handleAddExpressionClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleAddExpressionClose = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)
  const id = open ? 'simple-popover' : undefined

  return (
    <>
      <div className={classes.SimulationOptions}>
        <SimulationScreen open={simulateOpen} isResult={isResult} close={handleSimulateClose} />

        {/* Simulation modes list */}
        <List>

          {/* DC Solver */}
          <ListItem className={classes.simulationOptions} divider>
            <div className={classes.propertiesBox}>
              <ExpansionPanel>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls='panel1a-content'
                  id='panel1a-header'
                >
                  <Typography className={classes.heading}>DC Solver</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <form>
                    <List>
                      <ListItem>

                        <Button aria-describedby={id} variant='outlined' color='primary' size='small' onClick={handleAddExpressionClick}>
                          Add Expression
                        </Button>
                        <Tooltip title={'Add expression seperated by spaces.\n Include #branch at end of expression to indicate current  e.g v1#branch. To add multiple expression seperate them by spaces eg. v1 v2 v3#branch'}>
                          <IconButton aria-label='info'>
                            <InfoOutlinedIcon style={{ fontSize: 'large' }} />
                          </IconButton>
                        </Tooltip>
                        <Popover
                          id={id}
                          open={open}
                          anchorEl={anchorEl}
                          onClose={handleAddExpressionClose}

                          anchorOrigin={{
                            vertical: 'center',
                            horizontal: 'left'
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left'
                          }}
                        >

                          <TextField id='controlBlockParam' placeHolder='enter expression' size='large' variant='outlined'
                            value={controlBlockParam}
                            onChange={handleControlBlockParam}
                          />
                        </Popover>
                      </ListItem>
                      <ListItem>
                        <Button size='small' variant='contained' color='primary'
                          onClick={(e) => { startSimulate('DcSolver') }}>
                          Run dc solver
                        </Button>
                      </ListItem>
                    </List>
                  </form>
                </ExpansionPanelDetails>
              </ExpansionPanel>

            </div>
          </ListItem>

          {/* DC Sweep */}
          <ListItem className={classes.simulationOptions} divider>
            <ExpansionPanel onClick={onDcSweepTabExpand}>
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls='panel1a-content'
                id='panel1a-header'
              >
                <Typography className={classes.heading}>DC Sweep</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <form className={classes.propertiesBox} noValidate autoComplete='off'>
                  <List>
                    <ListItem>
                      <TextField
                        style={{ width: '100%' }}
                        id='parameter'
                        size='small'
                        variant='outlined'
                        select
                        label='Select Component'
                        value={dcSweepcontrolLine.parameter}
                        onChange={handleDcSweepControlLine}
                        SelectProps={{
                          native: true
                        }}
                      >

                        {
                          componentsList.map((value, i) => {
                            if (value.charAt(0) === 'V' || value.charAt(0) === 'v' || value.charAt(0) === 'I' || value.charAt(0) === 'i' || value === '') {
                              return (<option key={i} value={value}>
                                {value}
                              </option>)
                            } else {
                              return null
                            }
                          })
                        }

                      </TextField>

                    </ListItem>

                    <ListItem>
                      <TextField id='start' label='Start Voltage' size='small' variant='outlined'
                        value={dcSweepcontrolLine.start}
                        onChange={handleDcSweepControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>V</span>
                    </ListItem>
                    <ListItem>
                      <TextField id='stop' label='Stop Voltage' size='small' variant='outlined'
                        value={dcSweepcontrolLine.stop}
                        onChange={handleDcSweepControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>V</span>
                    </ListItem>
                    <ListItem>
                      <TextField id='step' label='Step' size='small' variant='outlined'
                        value={dcSweepcontrolLine.step}
                        onChange={handleDcSweepControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>V</span>
                    </ListItem>

                    {/* SECONDARY PARAMETER FOR SWEEP */}
                    <Divider />
                    <ListItem>

                      <h4 style={{ marginLeft: '10px' }}>Secondary Parameters</h4>
                    </ListItem>

                    <ListItem>

                      <TextField
                        style={{ width: '100%' }}
                        id='parameter2'
                        size='small'
                        variant='outlined'
                        select
                        label='Select Component'
                        value={dcSweepcontrolLine.parameter2}
                        onChange={handleDcSweepControlLine}
                        SelectProps={{
                          native: true
                        }}

                      >

                        {
                          componentsList.map((value, i) => {
                            return <option key={i} value={value}>
                              {value}
                            </option>
                          })
                        }

                      </TextField>

                    </ListItem>

                    <ListItem>
                      <TextField id='start2' label='Start Value' size='small' variant='outlined'
                        value={dcSweepcontrolLine.start2}
                        onChange={handleDcSweepControlLine}
                      />

                    </ListItem>
                    <ListItem>
                      <TextField id='stop2' label='Stop Value' size='small' variant='outlined'
                        value={dcSweepcontrolLine.stop2}
                        onChange={handleDcSweepControlLine}
                      />

                    </ListItem>
                    <ListItem>
                      <TextField id='step2' label='Step Value' size='small' variant='outlined'
                        value={dcSweepcontrolLine.step2}
                        onChange={handleDcSweepControlLine}
                      />

                    </ListItem>
                    <ListItem>

                      <Button aria-describedby={id} variant='outlined' color='primary' size='small' onClick={handleAddExpressionClick}>
                        Add Expression
                      </Button>
                      <Tooltip title={'Add expression seperated by spaces.\n Include #branch at end of expression to indicate current  e.g v1#branch. To add multiple expression seperate them by spaces eg. v1 v2 v3#branch'}>
                        <IconButton aria-label='info'>
                          <InfoOutlinedIcon style={{ fontSize: 'large' }} />
                        </IconButton>
                      </Tooltip>
                      <Popover
                        id={id}
                        open={open}
                        anchorEl={anchorEl}
                        onClose={handleAddExpressionClose}

                        anchorOrigin={{
                          vertical: 'center',
                          horizontal: 'left'
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'left'
                        }}
                      >

                        <TextField id='controlBlockParam' placeHolder='enter expression' size='large' variant='outlined'
                          value={controlBlockParam}
                          onChange={handleControlBlockParam}
                        />

                      </Popover>

                    </ListItem>

                    <ListItem>
                      <Button id='dcSweepSimulate' size='small' variant='contained' color='primary' onClick={(e) => { startSimulate('DcSweep') }}>
                        Simulate
                      </Button>
                    </ListItem>
                  </List>
                </form>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          </ListItem>

          {/* Transient Analysis */}
          <ListItem className={classes.simulationOptions} divider>
            <ExpansionPanel>
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls='panel1a-content'
                id='panel1a-header'
              >
                <Typography className={classes.heading}>Transient Analysis</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <form className={classes.propertiesBox} noValidate autoComplete='off'>
                  <List>
                    <ListItem>
                      <TextField id='start' label='Start Time' size='small' variant='outlined'
                        value={transientAnalysisControlLine.start}
                        onChange={handleTransientAnalysisControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>S</span>
                    </ListItem>
                    <ListItem>
                      <TextField id='stop' label='Stop Time' size='small' variant='outlined'
                        value={transientAnalysisControlLine.stop}
                        onChange={handleTransientAnalysisControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>S</span>
                    </ListItem>
                    <ListItem>
                      <TextField id='step' label='Time Step' size='small' variant='outlined'
                        value={transientAnalysisControlLine.step}
                        onChange={handleTransientAnalysisControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>S</span>
                    </ListItem>

                    <ListItem>

                      <Button aria-describedby={id} variant='outlined' color='primary' size='small' onClick={handleAddExpressionClick}>
                        Add Expression
                      </Button>
                      <Tooltip title={'Add expression seperated by spaces.\n Include #branch at end of expression to indicate current  e.g v1#branch. To add multiple expression seperate them by spaces eg. v1 v2 v3#branch'}>
                        <IconButton aria-label='info'>
                          <InfoOutlinedIcon style={{ fontSize: 'large' }} />
                        </IconButton>
                      </Tooltip>
                      <Popover
                        id={id}
                        open={open}
                        anchorEl={anchorEl}
                        onClose={handleAddExpressionClose}

                        anchorOrigin={{
                          vertical: 'center',
                          horizontal: 'left'
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'left'
                        }}
                      >

                        <TextField id='controlBlockParam' placeHolder='enter expression' size='large' variant='outlined'
                          value={controlBlockParam}
                          onChange={handleControlBlockParam}
                        />

                      </Popover>

                    </ListItem>
                    <ListItem>
                      <Button id='transientAnalysisSimulate' size='small' variant='contained' color='primary' onClick={(e) => { startSimulate('Transient') }}>
                        Simulate
                      </Button>
                    </ListItem>
                  </List>
                </form>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          </ListItem>

          {/* AC Analysis */}
          <ListItem className={classes.simulationOptions} divider>
            <ExpansionPanel>
              <ExpansionPanelSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls='panel1a-content'
                id='panel1a-header'
              >
                <Typography className={classes.heading}>AC Analysis</Typography>
              </ExpansionPanelSummary>
              <ExpansionPanelDetails>
                <form className={classes.propertiesBox} noValidate autoComplete='off'>
                  <List>

                    <ListItem>
                      <TextField
                        style={{ width: '100%' }}
                        id='input'
                        size='small'
                        variant='outlined'
                        select
                        label='Type'
                        value={acAnalysisControlLine.input}
                        onChange={handleAcAnalysisControlLine}
                        SelectProps={{
                          native: true
                        }}

                      >
                        <option key='linear' value='lin'>
                          Linear
                        </option>
                        <option key='decade' value='dec'>
                          Decade
                        </option>
                        <option key='octave' value='oct'>
                          Octave
                        </option>
                      </TextField>
                    </ListItem>

                    <ListItem>
                      <TextField id='pointsBydecade' label='Points/ Decade' size='small' variant='outlined'
                        value={acAnalysisControlLine.pointsBydecade}
                        onChange={handleAcAnalysisControlLine}
                      />
                    </ListItem>
                    <ListItem>
                      <TextField id='start' label='Start Frequency' size='small' variant='outlined'
                        value={acAnalysisControlLine.start}
                        onChange={handleAcAnalysisControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>Hz</span>
                    </ListItem>
                    <ListItem>
                      <TextField id='stop' label='Stop Frequency' size='small' variant='outlined'
                        value={acAnalysisControlLine.stop}
                        onChange={handleAcAnalysisControlLine}
                      />
                      <span style={{ marginLeft: '10px' }}>Hz</span>
                    </ListItem>

                    <ListItem>

                      <Button aria-describedby={id} variant='outlined' color='primary' size='small' onClick={handleAddExpressionClick}>
                        Add Expression
                      </Button>
                      <Tooltip title={'Add expression seperated by spaces. Include #branch at end of expression to indicate current  e.g v1#branch. To add multiple expression seperate them by spaces eg. v1 v2 v3#branch'}>
                        <IconButton aria-label='info'>
                          <InfoOutlinedIcon style={{ fontSize: 'large' }} />
                        </IconButton>
                      </Tooltip>
                      <Popover
                        id={id}
                        open={open}
                        anchorEl={anchorEl}
                        onClose={handleAddExpressionClose}

                        anchorOrigin={{
                          vertical: 'center',
                          horizontal: 'left'
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'left'
                        }}
                      >

                        <TextField id='controlBlockParam' placeHolder='enter expression' size='large' variant='outlined'
                          value={controlBlockParam}
                          onChange={handleControlBlockParam}
                        />

                      </Popover>

                    </ListItem>

                    <ListItem>
                      <Button size='small' variant='contained' color='primary' onClick={(e) => { startSimulate('Ac') }}>
                        Simulate
                      </Button>
                    </ListItem>
                  </List>
                </form>
              </ExpansionPanelDetails>
            </ExpansionPanel>
          </ListItem>

          <ListItem style={isSimRes ? {} : { display: 'none' }} onClick={handlesimulateOpen} >
            <Button size='small' variant='contained' color='primary' style={{ margin: '10px auto' }} onClick={handlesimulateOpen}>
              Simulation Result
            </Button>
          </ListItem>
        </List>
      </div>
    </>
  )
}
